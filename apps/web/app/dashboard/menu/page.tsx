"use client";

import Link from "next/link";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarDays,
  Camera,
  ChevronRight,
  EyeOff,
  GripVertical,
  ListPlus,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  UtensilsCrossed,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ItemEditor } from "@/components/dashboard/item-editor";
import { SpecialSheet } from "@/components/dashboard/special-sheet";
import {
  errorMessage,
  PageHead,
  ProSheet,
  SheetHead,
  Switch,
  useToast,
} from "@/components/dashboard/ui";
import {
  formatPrice,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menu-domain";
import { normalizeSearch } from "@/lib/menu-filters";
import { useMenuStore } from "@/lib/menu-store";
import {
  completionCounts,
  isIncomplete,
  missingPhoto,
} from "@/lib/menu-quality";
import { usePublication } from "@/lib/use-publication";

type Editing = { categoryId: string; item?: MenuItem } | null;
type Drag = {
  categoryId: string;
  draggingId: string;
  original: string[];
  ids: string[];
  mids: number[];
  startY: number;
};

export default function MenuPage() {
  const { state, setSoldOut, reorderCategories, reorderItems } = useMenuStore();
  const { changedItemIds } = usePublication();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [categorySheet, setCategorySheet] = useState<
    { mode: "add" } | { mode: "edit"; category: MenuCategory } | null
  >(null);
  const [addSheet, setAddSheet] = useState(false);
  const [specialSheet, setSpecialSheet] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("filtre") ===
      "a-completer"
    )
      setIncompleteOnly(true);
  }, []);

  const soldOut = useMemo(
    () => new Set(state.live.soldOutIds),
    [state.live.soldOutIds],
  );
  const allItems = state.categories.flatMap((category) => category.items);
  const incompleteCount = completionCounts(state.categories).incomplete;
  const needle = normalizeSearch(query);

  const blocks = state.categories
    .filter(
      (category) =>
        reordering ||
        categoryFilter === "all" ||
        category.id === categoryFilter,
    )
    .map((category) => {
      let items = category.items;
      if (drag?.categoryId === category.id)
        items = drag.ids.map((id) =>
          category.items.find((item) => item.id === id)!,
        );
      if (!reordering) {
        if (needle)
          items = items.filter((item) =>
            normalizeSearch(item.name).includes(needle),
          );
        if (incompleteOnly)
          items = items.filter((item) => isIncomplete(item, category));
      }
      return { category, items };
    })
    .filter(
      ({ items }) => reordering || items.length || (!needle && !incompleteOnly),
    );

  async function toggleAvailability(item: MenuItem, available: boolean) {
    try {
      await setSoldOut(item.id, !available);
      toast(
        available
          ? `${item.name} est de retour sur la carte`
          : `${item.name} épuisé · affiché comme tel en salle`,
      );
    } catch (cause) {
      toast(errorMessage(cause));
    }
  }

  async function moveItem(
    category: MenuCategory,
    index: number,
    delta: number,
  ) {
    const ids = category.items.map((item) => item.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await reorderItems(category.id, ids);
    } catch (cause) {
      toast(errorMessage(cause));
    }
  }

  async function moveCategory(index: number, delta: number) {
    const ids = state.categories.map((category) => category.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await reorderCategories(ids);
    } catch (cause) {
      toast(errorMessage(cause));
    }
  }

  // While dragging, rows are re-ordered live: React moves the dragged row in
  // the DOM, which can drop pointer capture, so movement is followed on
  // window rather than on the handle.
  const dragRef = useRef<Drag | null>(null);
  const dragging = drag !== null;

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    category: MenuCategory,
    itemId: string,
  ) {
    const list = event.currentTarget.closest("[data-reorder-list]");
    if (!list) return;
    event.preventDefault();
    const rows = Array.from(
      list.querySelectorAll<HTMLElement>("[data-row-id]"),
    );
    const next: Drag = {
      categoryId: category.id,
      draggingId: itemId,
      original: rows.map((row) => row.dataset.rowId!),
      ids: rows.map((row) => row.dataset.rowId!),
      mids: rows.map((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top + rect.height / 2;
      }),
      startY: event.clientY,
    };
    dragRef.current = next;
    setDrag(next);
  }

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      event.preventDefault();
      const from = current.original.indexOf(current.draggingId);
      const position = current.mids[from]! + (event.clientY - current.startY);
      const ids = current.original.filter((id) => id !== current.draggingId);
      const target = current.mids.filter(
        (mid, index) => index !== from && mid < position,
      ).length;
      ids.splice(target, 0, current.draggingId);
      if (ids.join() === current.ids.join()) return;
      dragRef.current = { ...current, ids };
      setDrag(dragRef.current);
    };
    const end = () => {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || current.ids.join() === current.original.join()) return;
      Promise.resolve(reorderItems(current.categoryId, current.ids)).catch(
        (cause: unknown) => toast(errorMessage(cause)),
      );
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, reorderItems, toast]);

  return (
    <>
      <PageHead
        eyebrow={`${allItems.length} plat${allItems.length > 1 ? "s" : ""} · ${state.categories.length} catégorie${state.categories.length > 1 ? "s" : ""}`}
        title="La carte"
        actions={
          state.categories.length ? (
            <button
              className={`pro-btn ${reordering ? "dark" : "line"} small`}
              type="button"
              aria-pressed={reordering}
              onClick={() => setReordering(!reordering)}
            >
              <GripVertical size={16} />{" "}
              {reordering ? "Terminer" : "Réorganiser"}
            </button>
          ) : null
        }
      />

      <div className="pro-utility-links">
        <Link href="/preview" target="_blank">
          Prévisualiser le brouillon
        </Link>
        <Link href="/dashboard/history">Historique</Link>
        <Link href="/dashboard/tools">Importer et exporter</Link>
      </div>

      {state.categories.length ? (
        <>
          {reordering ? (
            <p className="pro-banner dark">
              <GripVertical size={16} /> Faites glisser les plats, ou utilisez
              les flèches. L’ordre est publié avec la carte.
            </p>
          ) : (
            <>
              <label className="pro-search">
                <Search size={17} />
                <span className="sr-only">Rechercher un plat</span>
                <input
                  placeholder="Rechercher un plat"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div
                className="pro-chip-bar"
                role="group"
                aria-label="Filtrer la carte"
              >
                <button
                  type="button"
                  className="pro-chip"
                  aria-pressed={categoryFilter === "all" && !incompleteOnly}
                  onClick={() => {
                    setCategoryFilter("all");
                    setIncompleteOnly(false);
                  }}
                >
                  Tout <small>{allItems.length}</small>
                </button>
                {state.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className="pro-chip"
                    aria-pressed={categoryFilter === category.id}
                    onClick={() => setCategoryFilter(category.id)}
                  >
                    {category.name} <small>{category.items.length}</small>
                  </button>
                ))}
                {incompleteCount ? (
                  <button
                    type="button"
                    className="pro-chip warn"
                    aria-pressed={incompleteOnly}
                    onClick={() => setIncompleteOnly(!incompleteOnly)}
                  >
                    <AlertTriangle size={14} /> À compléter{" "}
                    <small>{incompleteCount}</small>
                  </button>
                ) : null}
              </div>
              {incompleteCount && !incompleteOnly ? (
                <button
                  className="pro-banner warn"
                  type="button"
                  onClick={() => setIncompleteOnly(true)}
                >
                  <AlertTriangle size={16} />
                  <span>
                    {incompleteCount} plat{incompleteCount > 1 ? "s" : ""} à
                    compléter : photo ou allergènes manquants
                  </span>
                  <ChevronRight size={16} />
                </button>
              ) : null}
            </>
          )}

          {blocks.map(({ category, items }) => {
            const categoryIndex = state.categories.indexOf(category);
            return (
              <section
                key={category.id}
                className="pro-card pro-category"
                aria-labelledby={`cat-${category.id}`}
              >
                <header className="pro-category-head">
                  <div>
                    <h2 id={`cat-${category.id}`}>{category.name}</h2>
                    <small>
                      {category.items.length} plat
                      {category.items.length > 1 ? "s" : ""}
                      {category.eyebrow ? ` · ${category.eyebrow}` : ""}
                    </small>
                  </div>
                  {reordering ? (
                    <span className="pro-arrows">
                      <button
                        type="button"
                        aria-label={`Monter ${category.name}`}
                        disabled={categoryIndex === 0}
                        onClick={() => moveCategory(categoryIndex, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${category.name}`}
                        disabled={categoryIndex === state.categories.length - 1}
                        onClick={() => moveCategory(categoryIndex, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </span>
                  ) : (
                    <button
                      className="pro-icon-btn plain"
                      type="button"
                      aria-label={`Options de ${category.name}`}
                      onClick={() =>
                        setCategorySheet({ mode: "edit", category })
                      }
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  )}
                </header>
                <ul className="pro-rows" data-reorder-list>
                  {items.map((item, index) => {
                    const available = !soldOut.has(item.id);
                    return (
                      <li
                        key={item.id}
                        data-row-id={item.id}
                        className={`pro-row ${available && item.available ? "" : "off"} ${drag?.draggingId === item.id ? "dragging" : ""}`}
                      >
                        {reordering ? (
                          <span
                            className="pro-grip"
                            aria-hidden="true"
                            onPointerDown={(event) =>
                              startDrag(event, category, item.id)
                            }
                          >
                            <GripVertical size={18} />
                          </span>
                        ) : null}
                        <button
                          className="pro-row-main"
                          type="button"
                          aria-label={`Modifier ${item.name}`}
                          disabled={reordering}
                          onClick={() =>
                            setEditing({ categoryId: category.id, item })
                          }
                        >
                          <span
                            className={`pro-thumb ${item.images[0] ? "" : "empty"}`}
                            style={
                              item.images[0]
                                ? {
                                    backgroundImage: `url(${item.images[0].dataUrl})`,
                                  }
                                : undefined
                            }
                          >
                            {item.images[0] ? null : <Camera size={16} />}
                          </span>
                          <span className="pro-row-copy">
                            <strong>{item.name}</strong>
                            <small>
                              <span>{formatPrice(item.priceCents)}</span>
                              {!available ? (
                                <span className="pro-flag off">
                                  <Ban size={12} /> Épuisé
                                </span>
                              ) : null}
                              {!item.available ? (
                                <span className="pro-flag off">
                                  <EyeOff size={12} /> Masqué
                                </span>
                              ) : null}
                              {changedItemIds.has(item.id) ? (
                                <span className="pro-flag mod">● Modifié</span>
                              ) : null}
                              {missingPhoto(item, category) ? (
                                <span className="pro-flag warn">
                                  <Camera size={12} /> Sans photo
                                </span>
                              ) : null}
                              {item.allergens === undefined ? (
                                <span className="pro-flag warn">
                                  <ShieldAlert size={12} /> Allergènes ?
                                </span>
                              ) : null}
                            </small>
                          </span>
                        </button>
                        {reordering ? (
                          <span className="pro-arrows">
                            <button
                              type="button"
                              aria-label={`Monter ${item.name}`}
                              disabled={index === 0}
                              onClick={() => moveItem(category, index, -1)}
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Descendre ${item.name}`}
                              disabled={index === items.length - 1}
                              onClick={() => moveItem(category, index, 1)}
                            >
                              <ArrowDown size={15} />
                            </button>
                          </span>
                        ) : (
                          <Switch
                            checked={available}
                            label={`Disponibilité de ${item.name}`}
                            onChange={(next) => toggleAvailability(item, next)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {reordering ? null : (
                  <button
                    className="pro-row-link"
                    type="button"
                    onClick={() => setEditing({ categoryId: category.id })}
                  >
                    <Plus size={16} /> Ajouter un plat
                  </button>
                )}
              </section>
            );
          })}
          {!blocks.length ? (
            <p className="pro-card pro-muted center">
              Aucun plat ne correspond.
            </p>
          ) : null}
        </>
      ) : (
        <section className="pro-card pro-empty">
          <span className="pro-tile">
            <UtensilsCrossed size={22} />
          </span>
          <h2>Votre carte est vide</h2>
          <p>
            Commencez par une catégorie, par exemple « Entrées » ou « Vins ».
          </p>
          <button
            className="pro-btn primary"
            type="button"
            onClick={() => setCategorySheet({ mode: "add" })}
          >
            Créer une catégorie
          </button>
        </section>
      )}

      {reordering ? null : (
        <button
          className="pro-fab"
          type="button"
          onClick={() => setAddSheet(true)}
        >
          <Plus size={20} /> Ajouter
        </button>
      )}

      {addSheet ? (
        <ProSheet onClose={() => setAddSheet(false)} labelledBy="add-title">
          <SheetHead
            id="add-title"
            title="Ajouter"
            onClose={() => setAddSheet(false)}
          />
          <div className="pro-sheet-body">
            <ul className="pro-actions">
              {state.categories.length ? (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setAddSheet(false);
                      setEditing({ categoryId: state.categories[0]!.id });
                    }}
                  >
                    <span className="pro-tile">
                      <UtensilsCrossed size={19} />
                    </span>
                    <span>
                      <strong>Un plat</strong>
                      <small>Photo, prix, allergènes</small>
                    </span>
                  </button>
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAddSheet(false);
                    setCategorySheet({ mode: "add" });
                  }}
                >
                  <span className="pro-tile">
                    <ListPlus size={19} />
                  </span>
                  <span>
                    <strong>Une catégorie</strong>
                    <small>Ex. « Antipasti », « Vins rouges »</small>
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAddSheet(false);
                    setSpecialSheet(true);
                  }}
                >
                  <span className="pro-tile">
                    <CalendarDays size={19} />
                  </span>
                  <span>
                    <strong>La suggestion du jour</strong>
                    <small>En tête de carte, en ligne immédiatement</small>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </ProSheet>
      ) : null}

      {categorySheet ? (
        <CategorySheet
          category={
            categorySheet.mode === "edit" ? categorySheet.category : undefined
          }
          onClose={() => setCategorySheet(null)}
        />
      ) : null}
      {specialSheet ? (
        <SpecialSheet
          special={state.live.special}
          onClose={() => setSpecialSheet(false)}
        />
      ) : null}
      {editing ? (
        <ItemEditor
          key={editing.item?.id ?? "new"}
          categoryId={editing.categoryId}
          item={editing.item}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function CategorySheet({
  category,
  onClose,
}: {
  category?: MenuCategory;
  onClose: () => void;
}) {
  const { addCategory, updateCategory, deleteCategory } = useMenuStore();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [eyebrow, setEyebrow] = useState(category?.eyebrow ?? "");
  const [error, setError] = useState("");

  const dirty =
    name !== (category?.name ?? "") || eyebrow !== (category?.eyebrow ?? "");
  useUnsavedChanges(dirty);
  function requestClose() {
    if (!dirty || confirm("Abandonner les modifications non enregistrées ?"))
      onClose();
  }

  async function submit() {
    if (!name.trim()) return setError("Donnez un nom à la catégorie.");
    try {
      if (category) {
        await updateCategory(category.id, {
          name: name.trim(),
          eyebrow: eyebrow.trim(),
        });
        toast("Catégorie modifiée · à publier");
      } else {
        await addCategory({ name, eyebrow });
        toast(`Catégorie « ${name.trim()} » ajoutée`);
      }
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <ProSheet onClose={requestClose} labelledBy="category-title">
      <SheetHead
        id="category-title"
        title={category ? category.name : "Nouvelle catégorie"}
        onClose={requestClose}
      />
      <form
        className="pro-sheet-body"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="pro-form">
          <label className="pro-field">
            <span>Nom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Antipasti"
              data-autofocus
            />
          </label>
          <label className="pro-field">
            <span>Sous-titre</span>
            <input
              value={eyebrow}
              onChange={(event) => setEyebrow(event.target.value)}
              placeholder="Pour commencer"
            />
          </label>
        </div>
        {error ? (
          <p className="pro-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="pro-btn primary block" type="submit">
          {category ? "Enregistrer" : "Ajouter la catégorie"}
        </button>
        {category ? (
          <button
            className="pro-btn danger block"
            type="button"
            onClick={async () => {
              if (
                !confirm(
                  `Supprimer la catégorie « ${category.name} » et ses ${category.items.length} plat(s) ?`,
                )
              )
                return;
              try {
                await deleteCategory(category.id);
                toast(`Catégorie « ${category.name} » supprimée · à publier`);
                onClose();
              } catch (cause) {
                setError(errorMessage(cause));
              }
            }}
          >
            Supprimer la catégorie
          </button>
        ) : null}
      </form>
    </ProSheet>
  );
}
