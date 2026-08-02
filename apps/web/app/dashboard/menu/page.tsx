"use client";

import {
  ArrowDown,
  ArrowUp,
  Edit3,
  GripVertical,
  ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { ItemDialog } from "@/components/dashboard/item-dialog";
import { MenuPhonePreview } from "@/components/menu/menu-phone-preview";
import { formatPrice, type MenuItem } from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

export default function MenuEditorPage() {
  const {
    state,
    addCategory,
    deleteCategory,
    moveCategory,
    deleteItem,
    moveItem,
    updateItem,
  } = useMenuStore();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryEyebrow, setCategoryEyebrow] = useState("");
  const [editing, setEditing] = useState<{
    categoryId: string;
    item?: MenuItem;
  } | null>(null);
  const publicationState =
    state.published?.publishedAt === state.changedAt ? "Publié" : "Brouillon";

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">Menu principal · {publicationState}</span>
          <h1 className="serif">Composer le menu</h1>
        </div>
        <button
          className="button button-dark"
          type="button"
          onClick={() => setShowCategoryForm(true)}
        >
          <Plus size={16} /> Catégorie
        </button>
      </div>
      {showCategoryForm ? (
        <form
          className="inline-form"
          aria-label="Nouvelle catégorie"
          onSubmit={(event) => {
            event.preventDefault();
            if (!categoryName.trim()) return;
            addCategory({ name: categoryName, eyebrow: categoryEyebrow });
            setCategoryName("");
            setCategoryEyebrow("");
            setShowCategoryForm(false);
          }}
        >
          <div className="form-group">
            <label htmlFor="category-name">Nom</label>
            <input
              className="input"
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="category-eyebrow">Sous-titre</label>
            <input
              className="input"
              id="category-eyebrow"
              value={categoryEyebrow}
              onChange={(e) => setCategoryEyebrow(e.target.value)}
              placeholder="Pour commencer"
            />
          </div>
          <button className="button button-primary" type="submit">
            Ajouter
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setShowCategoryForm(false)}
          >
            Annuler
          </button>
        </form>
      ) : null}
      <div className="builder-grid">
        <section>
          {state.categories.length === 0 ? (
            <div className="empty-state">
              <UtensilsIcon />
              <h2 className="serif">Votre menu est vide</h2>
              <p>Commencez par créer une catégorie.</p>
              <button
                className="button button-primary"
                onClick={() => setShowCategoryForm(true)}
              >
                Créer une catégorie
              </button>
            </div>
          ) : null}
          {state.categories.map((category, categoryIndex) => (
            <article
              className="builder-section"
              key={category.id}
              data-testid={`category-${category.id}`}
            >
              <div className="builder-section-head">
                <div>
                  <h2>{category.name}</h2>
                  <p>
                    {category.items.length} plat
                    {category.items.length > 1 ? "s" : ""} ·{" "}
                    {category.eyebrow || "Sans sous-titre"}
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Monter ${category.name}`}
                    disabled={categoryIndex === 0}
                    onClick={() => moveCategory(category.id, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Descendre ${category.name}`}
                    disabled={categoryIndex === state.categories.length - 1}
                    onClick={() => moveCategory(category.id, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label={`Supprimer ${category.name}`}
                    onClick={() => {
                      if (
                        confirm(
                          `Supprimer la catégorie « ${category.name} » et tous ses plats ?`,
                        )
                      )
                        deleteCategory(category.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {category.items.map((item, itemIndex) => (
                <div
                  className={`menu-row ${!item.available ? "is-muted" : ""}`}
                  key={item.id}
                  data-testid={`menu-item-${item.id}`}
                >
                  <GripVertical size={18} color="#9a9086" />
                  <span
                    className="menu-row-art"
                    style={
                      item.images[0]
                        ? {
                            backgroundImage: `url(${item.images[0].dataUrl})`,
                            backgroundSize: "cover",
                          }
                        : undefined
                    }
                  >
                    {item.video ? <span>▶</span> : <ImageIcon size={18} />}
                  </span>
                  <button
                    className="menu-row-copy"
                    type="button"
                    onClick={() =>
                      setEditing({ categoryId: category.id, item })
                    }
                  >
                    <h3>{item.name}</h3>
                    <p>{item.description || "Sans description"}</p>
                    <p>
                      {item.video
                        ? `${item.video.provider === "youtube" ? "YouTube" : "Vimeo"} · Vidéo externe`
                        : `${item.images.length} image${item.images.length > 1 ? "s" : ""}`}
                    </p>
                  </button>
                  <span className="menu-row-price">
                    {formatPrice(item.priceCents)}
                  </span>
                  <div className="row-actions item-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Monter ${item.name}`}
                      disabled={itemIndex === 0}
                      onClick={() => moveItem(category.id, item.id, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Descendre ${item.name}`}
                      disabled={itemIndex === category.items.length - 1}
                      onClick={() => moveItem(category.id, item.id, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Modifier ${item.name}`}
                      onClick={() =>
                        setEditing({ categoryId: category.id, item })
                      }
                    >
                      <Edit3 size={14} />
                    </button>
                    <label className="switch" title="Disponibilité">
                      <input
                        type="checkbox"
                        checked={item.available}
                        onChange={(e) =>
                          updateItem(category.id, item.id, {
                            available: e.target.checked,
                          })
                        }
                        aria-label={`Disponibilité de ${item.name}`}
                      />
                      <span />
                    </label>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label={`Supprimer ${item.name}`}
                      onClick={() => deleteItem(category.id, item.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="button"
                style={{ marginTop: 12 }}
                type="button"
                onClick={() => setEditing({ categoryId: category.id })}
              >
                <Plus size={15} /> Ajouter un plat
              </button>
            </article>
          ))}
        </section>
        <aside className="builder-preview">
          <MenuPhonePreview venue={state.venue} categories={state.categories} />
        </aside>
      </div>
      {editing ? (
        <ItemDialog
          categoryId={editing.categoryId}
          item={editing.item}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function UtensilsIcon() {
  return <span className="empty-icon">✦</span>;
}
