"use client";

import { api } from "@repo/backend/api";
import { useConvex, useQuery } from "convex/react";
import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Info,
  Leaf,
  Navigation,
  Phone,
  Play,
  Search,
  ShieldAlert,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AddButton, DishRow } from "@/components/menu/dish-row";
import { DishSheet, type SheetDish } from "@/components/menu/dish-sheet";
import {
  AllergenSheet,
  InfoSheet,
  SearchSheet,
  SelectionSheet,
  WaiterView,
  directionsUrl,
  telUrl,
  type SelectionLine,
} from "@/components/menu/menu-sheets";
import { MenuTrackerProvider, useMenuTracker } from "@/components/menu/menu-tracker";
import { VideoModal } from "@/components/menu/menu-video";
import { readableInk, safeAccent } from "@/lib/color";
import { convex } from "@/lib/convex";
import { statsDay } from "@/lib/menu-analytics";
import {
  createDemoState,
  DEMO_POPULAR_IDS,
  DEMO_VENUE_ID,
  formatPrice,
  type DailySpecial,
  type LiveService,
  type MenuItem,
  type MenuSnapshot,
} from "@/lib/menu-domain";
import {
  EMPTY_FILTER,
  filterSummary,
  isFilterActive,
  isHiddenByFilter,
  toggleAvoid,
  type DietFilter,
} from "@/lib/menu-filters";
import {
  decodeSelection,
  encodeSelection,
  mergeSelections,
  sanitizeSelection,
  selectionCount,
  selectionStorageKey,
  setQuantity,
  type Selection,
} from "@/lib/menu-selection";
import { toLiveData, toMenuSnapshot } from "@/lib/menu-snapshot";
import { useMenuStore } from "@/lib/menu-store";
import { openingStatus } from "@/lib/opening-hours";

type PublicLive = Pick<LiveService, "soldOutIds" | "special">;

export function PublicMenu({ slug }: { slug: string }) {
  if (convex) return <RemotePublicMenu slug={slug} />;
  return <LocalPublicMenu slug={slug} />;
}

function MenuLoading() {
  return (
    <main className="public-loading pm-root">
      <span className="pm-loader" aria-hidden="true" />
      Chargement du menu…
    </main>
  );
}

function MenuNotFound() {
  return (
    <main className="public-not-found pm-root">
      <span className="pm-eyebrow">Menu indisponible</span>
      <h1>Cette table est encore vide.</h1>
      <p>Ce menu n’existe pas ou n’a pas encore été publié.</p>
      <Link className="pm-btn primary" href="/">
        Retour à MenuShare
      </Link>
    </main>
  );
}

function LocalPublicMenu({ slug }: { slug: string }) {
  const { state, hydrated } = useMenuStore();
  const snapshot =
    state.published?.venue.slug === slug ? state.published : undefined;

  if (!hydrated) return <MenuLoading />;
  if (!snapshot) return <MenuNotFound />;
  return (
    <PublishedMenu
      snapshot={snapshot}
      live={state.live}
      popularIds={state.venue.id === DEMO_VENUE_ID ? DEMO_POPULAR_IDS : []}
    />
  );
}

function RemotePublicMenu({ slug }: { slug: string }) {
  const result: unknown = useQuery(api.menus.getPublishedBySlug, { slug });
  if (result === undefined) return <MenuLoading />;
  const snapshot = toMenuSnapshot(result);
  if (!snapshot) {
    if (slug === "nonna-lydie") {
      const demo = createDemoState();
      return (
        <PublishedMenu
          snapshot={demo.published!}
          live={demo.live}
          popularIds={DEMO_POPULAR_IDS}
        />
      );
    }
    return <MenuNotFound />;
  }
  return (
    <MenuTrackerProvider venueId={snapshot.venue.id}>
      <RemotePublishedMenu snapshot={snapshot} />
    </MenuTrackerProvider>
  );
}

/**
 * Sold-out dishes and the suggestion of the day come from their own live
 * query, so a toggle does not resend the whole menu to every diner.
 */
function RemotePublishedMenu({ snapshot }: { snapshot: MenuSnapshot }) {
  const venueId = snapshot.venue.id;
  const liveResult: unknown = useQuery(api.menus.getLiveService, { venueId });
  const live = useMemo(() => toLiveData(liveResult), [liveResult]);
  const popularIds = usePopularItems(venueId);
  return (
    <PublishedMenu snapshot={snapshot} live={live} popularIds={popularIds} />
  );
}

/**
 * Read once per visit rather than subscribed: every dish opening changes the
 * ranking, and a live subscription would re-run it for every diner.
 */
function usePopularItems(venueId: string) {
  const client = useConvex();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    client
      .query(api.analytics.popularItems, { venueId, today: statsDay(Date.now()) })
      .then((result) => {
        if (!cancelled) setIds(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, venueId]);
  return ids;
}

/** Current time, refreshed every minute; `null` until mounted. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type VisitContext = { table?: number; inVenue: boolean };

/**
 * How the diner arrived: a table QR code shows "Table N" and puts the dishes
 * first, a direct link shows how to come. Remembered for the browser session
 * because tracking removes the QR parameters from the address.
 */
function readVisitContext(slug: string): VisitContext {
  const key = `menushare.visit.${slug}`;
  const params = new URLSearchParams(window.location.search);
  const rawTable = params.get("t");
  let context: VisitContext | null = null;
  if (rawTable !== null) {
    const table = /^\d{1,3}$/.test(rawTable) ? Number(rawTable) : 0;
    context = table > 0 ? { table, inVenue: true } : { inVenue: true };
  } else if (params.get("src") === "qr") {
    context = { inVenue: true };
  }
  try {
    if (context) {
      sessionStorage.setItem(key, JSON.stringify(context));
      return context;
    }
    const stored = JSON.parse(sessionStorage.getItem(key) ?? "null") as
      | VisitContext
      | null;
    if (stored && typeof stored.inVenue === "boolean") return stored;
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return context ?? { inVenue: false };
}

const SELECTION_TTL_MS = 12 * 60 * 60 * 1000;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "M"
  );
}

function specialToDish(special: DailySpecial): SheetDish {
  return {
    id: `special:${special.id}`,
    name: special.name,
    description: special.description,
    details: special.description,
    priceCents: special.priceCents,
    available: true,
    images: special.imageUrl
      ? [{ id: `special-image-${special.id}`, dataUrl: special.imageUrl, alt: special.name }]
      : [],
    ingredients: [],
    tags: [],
    allergens: undefined,
    pairingName: "",
    reviewQuote: "",
    reviewAuthor: "",
    isSpecial: true,
  };
}

type Panel = "selection" | "waiter" | "info" | "allergens" | "search" | "story";

function PublishedMenu({
  snapshot,
  live,
  popularIds,
}: {
  snapshot: MenuSnapshot;
  live: PublicLive;
  popularIds: string[];
}) {
  const { venue } = snapshot;
  const tracker = useMenuTracker();
  const now = useNow();
  const [context, setContext] = useState<VisitContext | null>(null);
  const [filter, setFilter] = useState<DietFilter>(EMPTY_FILTER);
  const [showAll, setShowAll] = useState(false);
  const [selection, setSelection] = useState<Selection>({});
  const [selectionReady, setSelectionReady] = useState(false);
  const [openDishId, setOpenDishId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [stuck, setStuck] = useState(false);
  const stickyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const accent = safeAccent(venue.accentColor);
  const style = {
    "--accent": accent,
    "--accent-ink": readableInk(accent),
  } as CSSProperties;

  const categories = useMemo(
    () =>
      snapshot.categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => item.available),
        }))
        .filter((category) => category.items.length),
    [snapshot.categories],
  );
  const items = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const category of categories)
      for (const item of category.items) map.set(item.id, item);
    return map;
  }, [categories]);
  const soldOut = useMemo(() => new Set(live.soldOutIds), [live.soldOutIds]);
  const special =
    live.special && (now === null || live.special.endsAt > now)
      ? live.special
      : undefined;
  const specialDish = useMemo(
    () => (special ? specialToDish(special) : null),
    [special],
  );
  const popular = useMemo(
    () =>
      popularIds.filter((id) => items.has(id) && !soldOut.has(id)).slice(0, 4),
    [items, popularIds, soldOut],
  );
  const popularBadges = useMemo(() => new Set(popular.slice(0, 3)), [popular]);

  /** Everything a diner can keep in the selection, by selection key. */
  const orderables = useMemo(() => {
    const map = new Map<string, { name: string; priceCents: number }>();
    for (const item of items.values()) {
      map.set(item.id, { name: item.name, priceCents: item.priceCents });
      if (item.pairingName && item.pairingPriceCents !== undefined)
        map.set(`pairing:${item.id}`, {
          name: item.pairingName,
          priceCents: item.pairingPriceCents,
        });
    }
    if (specialDish)
      map.set(specialDish.id, {
        name: specialDish.name,
        priceCents: specialDish.priceCents,
      });
    return map;
  }, [items, specialDish]);

  const active = isFilterActive(filter) && !showAll;
  const visibleCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          items: active
            ? category.items.filter((item) => !isHiddenByFilter(item, filter))
            : category.items,
        }))
        .filter((category) => category.items.length),
    [active, categories, filter],
  );
  const totalCount = categories.reduce((n, c) => n + c.items.length, 0);
  const visibleCount = visibleCategories.reduce((n, c) => n + c.items.length, 0);
  const hiddenCount = totalCount - visibleCount;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => setContext(readVisitContext(venue.slug)), [venue.slug]);

  // Restore the selection, then merge a selection shared through `?sel=`.
  // The link is read once per venue: effects can run twice (StrictMode) and
  // the parameter is removed from the address after the first read.
  const sharedSelection = useRef<{ venueId: string; value: Selection } | null>(
    null,
  );
  useEffect(() => {
    const key = selectionStorageKey(venue.id);
    const valid = new Set(orderables.keys());
    if (sharedSelection.current?.venueId !== venue.id) {
      const params = new URLSearchParams(window.location.search);
      sharedSelection.current = {
        venueId: venue.id,
        value: decodeSelection(params.get("sel"), valid),
      };
      if (params.has("sel")) {
        params.delete("sel");
        const search = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
        );
      }
    }
    const shared = sharedSelection.current.value;
    let restored: Selection = {};
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "null") as {
        at?: number;
        items?: unknown;
      } | null;
      if (stored?.at && Date.now() - stored.at < SELECTION_TTL_MS)
        restored = sanitizeSelection(stored.items, valid);
    } catch {
      // A corrupted memo is simply dropped.
    }
    setSelection(mergeSelections(restored, shared));
    setSelectionReady(true);
    if (Object.keys(shared).length) setPanel("selection");
    // Restored once per venue: later menu updates must not reset the memo.
  }, [venue.id]);

  useEffect(() => {
    if (!selectionReady) return;
    try {
      localStorage.setItem(
        selectionStorageKey(venue.id),
        JSON.stringify({ at: Date.now(), items: selection }),
      );
    } catch {
      // The memo still works for this page view.
    }
  }, [selection, selectionReady, venue.id]);

  // Sticky bar shadow once the hero has scrolled away.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) =>
      setStuck(!entry!.isIntersecting),
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // Highlights the category being read.
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-menu-category]"),
    );
    if (!sections.length) return;
    const offset = (stickyRef.current?.offsetHeight ?? 100) + 8;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setActiveCategory(entry.target.getAttribute("data-menu-category")!);
      },
      { rootMargin: `-${offset}px 0px -60% 0px` },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [visibleCategories]);

  useEffect(() => {
    const nav = tabsRef.current;
    const tab = nav?.querySelector<HTMLElement>(`[data-tab="${activeCategory}"]`);
    if (!nav || !tab) return;
    nav.scrollTo({
      left: tab.offsetLeft - nav.clientWidth / 2 + tab.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [activeCategory]);

  function goToCategory(id: string) {
    const section = document.getElementById(`categorie-${id}`);
    if (!section) return;
    const offset = (stickyRef.current?.offsetHeight ?? 100) + 6;
    window.scrollTo({
      top: section.getBoundingClientRect().top + window.scrollY - offset,
      behavior: "smooth",
    });
    setActiveCategory(id);
  }

  function changeQuantity(id: string, quantity: number) {
    setSelection((current) => setQuantity(current, id, quantity));
  }

  function add(id: string) {
    const entry = orderables.get(id);
    if (!entry) return;
    setSelection((current) => setQuantity(current, id, (current[id] ?? 0) + 1));
    showToast(`${entry.name} ajouté à ma sélection`);
  }

  function openDish(id: string) {
    setPanel(null);
    setOpenDishId(id);
    if (items.has(id)) tracker.itemOpen(id);
  }

  async function shareSelection() {
    const url = `${window.location.origin}/menu/${venue.slug}?sel=${encodeSelection(selection)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ma sélection · ${venue.name}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Lien copié : la table voit la même sélection");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError")
        showToast("Partage impossible sur cet appareil");
    }
  }

  // A dish sold out after being picked stays visible, flagged, but leaves
  // the total and the waiter view.
  const lines: SelectionLine[] = Object.entries(selection)
    .filter(([id]) => orderables.has(id))
    .map(([id, quantity]) => ({
      id,
      quantity,
      soldOut: soldOut.has(id),
      ...orderables.get(id)!,
    }));
  const availableLines = lines.filter((line) => !line.soldOut);
  const count = selectionCount(
    Object.fromEntries(availableLines.map((line) => [line.id, line.quantity])),
  );
  const totalCents = availableLines.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );

  const sheetDish =
    openDishId === null
      ? null
      : openDishId === specialDish?.id
        ? specialDish
        : (items.get(openDishId) ?? null);
  const status = openingStatus(venue.openingHours, now ?? 0);
  const showStatus = now !== null && status;
  const directions = directionsUrl(venue);
  const inVenue = context?.inVenue ?? true;
  const avoidedOthers = filter.avoid.filter((key) => key !== "gluten").length;
  const railItems = popular
    .map((id) => items.get(id)!)
    .filter((item) => item.images.length && !(active && isHiddenByFilter(item, filter)));

  return (
    <main className="public-menu pm-root" style={style}>
      <header
        ref={heroRef}
        className={`pm-hero ${inVenue ? "" : "direct"}`}
        style={
          venue.coverImageDataUrl
            ? { backgroundImage: `url(${venue.coverImageDataUrl})` }
            : undefined
        }
      >
        <div className="pm-hero-top">
          {venue.logoDataUrl ? (
            <img
              className="pm-logo"
              src={venue.logoDataUrl}
              alt={`Logo ${venue.name}`}
            />
          ) : (
            <span className="pm-logo monogram" aria-hidden="true">
              {initials(venue.name)}
            </span>
          )}
          <button
            className="pm-glass round"
            type="button"
            aria-label="Infos pratiques"
            onClick={() => setPanel("info")}
          >
            <Info size={18} />
          </button>
        </div>
        <div className="pm-hero-bottom">
          <div className="pm-hero-chips">
            {context?.table ? (
              <span className="pm-hero-chip table">
                <UtensilsCrossed size={13} /> Table {context.table}
              </span>
            ) : null}
            {showStatus ? (
              <span className={`pm-hero-chip ${status.open ? "open" : "closed"}`}>
                <span className="pm-dot" aria-hidden="true" /> {status.label}
              </span>
            ) : null}
          </div>
          <h1>{venue.name}</h1>
          {venue.tagline ? <p className="pm-tagline">{venue.tagline}</p> : null}
          <div className="pm-hero-sub">
            <span>{[venue.kind, venue.city].filter(Boolean).join(" · ")}</span>
            {venue.coverVideo ? (
              <button
                className="pm-glass"
                type="button"
                aria-label="Lire la vidéo de couverture"
                onClick={() => setPanel("story")}
              >
                <Play size={12} fill="currentColor" /> Notre histoire
              </button>
            ) : null}
          </div>
          {!inVenue && (directions || venue.phone || venue.openingHours?.length) ? (
            <div className="pm-hero-actions">
              {directions ? (
                <a className="pm-glass" href={directions} target="_blank" rel="noreferrer">
                  <Navigation size={15} /> Itinéraire
                </a>
              ) : null}
              {venue.phone ? (
                <a className="pm-glass" href={telUrl(venue.phone)}>
                  <Phone size={15} /> Appeler
                </a>
              ) : null}
              <button className="pm-glass" type="button" onClick={() => setPanel("info")}>
                <Clock3 size={15} /> Horaires
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div ref={stickyRef} className={`pm-sticky ${stuck ? "stuck" : ""}`}>
        {categories.length > 1 ? (
          <div className="pm-tabs-row">
            <button
              className="pm-icon-btn"
              type="button"
              aria-label="Rechercher un plat"
              onClick={() => setPanel("search")}
            >
              <Search size={20} />
            </button>
            <nav ref={tabsRef} className="pm-tabs" aria-label="Catégories du menu">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  data-tab={category.id}
                  className={category.id === activeCategory ? "on" : ""}
                  aria-current={category.id === activeCategory ? "true" : undefined}
                  onClick={() => goToCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </nav>
          </div>
        ) : null}
        <div className="pm-filters" role="group" aria-label="Filtres de la carte">
          {categories.length > 1 ? null : (
            <button
              className="pm-chip icon"
              type="button"
              aria-label="Rechercher un plat"
              onClick={() => setPanel("search")}
            >
              <Search size={16} />
            </button>
          )}
          <button
            className="pm-chip"
            type="button"
            aria-pressed={filter.vegetarian}
            onClick={() => {
              setShowAll(false);
              setFilter({ ...filter, vegetarian: !filter.vegetarian });
            }}
          >
            <Leaf size={15} /> Végétarien
          </button>
          <button
            className="pm-chip"
            type="button"
            aria-pressed={filter.avoid.includes("gluten")}
            onClick={() => {
              setShowAll(false);
              setFilter(toggleAvoid(filter, "gluten"));
            }}
          >
            Sans gluten
          </button>
          <button
            className={`pm-chip ${avoidedOthers > 0 ? "on" : ""}`}
            type="button"
            aria-haspopup="dialog"
            aria-label={
              avoidedOthers
                ? `Allergies, ${avoidedOthers} allergène${avoidedOthers > 1 ? "s" : ""} évité${avoidedOthers > 1 ? "s" : ""}`
                : "Allergies"
            }
            onClick={() => setPanel("allergens")}
          >
            <ShieldAlert size={15} /> Allergies
            {avoidedOthers ? <span className="pm-count">{avoidedOthers}</span> : null}
          </button>
        </div>
      </div>

      <div className="pm-content">
        {active && hiddenCount ? (
          <p className="pm-notice" role="status">
            <ShieldAlert size={16} />
            <span>
              {hiddenCount} plat{hiddenCount > 1 ? "s" : ""} masqué
              {hiddenCount > 1 ? "s" : ""} · {filterSummary(filter)}
            </span>
            <button type="button" onClick={() => setShowAll(true)}>
              Tout voir
            </button>
          </p>
        ) : null}

        {specialDish && special ? (
          <section className="pm-special" aria-label="Suggestion du jour">
            <button
              className="pm-special-open"
              type="button"
              aria-label={`Voir ${special.name}`}
              onClick={() => openDish(specialDish.id)}
            >
              {special.imageUrl ? (
                <img src={special.imageUrl} alt="" className="pm-special-photo" />
              ) : null}
              <span>
                <span className="pm-eyebrow">
                  <CalendarDays size={13} /> Suggestion du jour
                </span>
                <strong>{special.name}</strong>
                {special.description ? <span>{special.description}</span> : null}
                <span className="pm-special-price">
                  {formatPrice(special.priceCents)}
                  <small> · jusqu’à épuisement</small>
                </span>
              </span>
            </button>
            <AddButton
              name={special.name}
              quantity={selection[specialDish.id] ?? 0}
              onAdd={() => add(specialDish.id)}
              className="inline"
            />
          </section>
        ) : null}

        {railItems.length >= 2 ? (
          <section className="pm-rail-block" aria-labelledby="popular-title">
            <div className="pm-section-label">
              <h2 id="popular-title">
                <TrendingUp size={17} /> Les plus consultés
              </h2>
              <span>ces 14 derniers jours</span>
            </div>
            <div className="pm-rail">
              {railItems.map((item, index) => (
                <article className="pm-rail-card" key={item.id}>
                  <button
                    className="pm-rail-open"
                    type="button"
                    aria-label={`Voir ${item.name}`}
                    onClick={() => openDish(item.id)}
                  >
                    <span className="pm-rail-photo">
                      <img src={item.images[0]!.dataUrl} alt="" loading="lazy" />
                      <span className="pm-rank">N°{index + 1}</span>
                    </span>
                    <strong>{item.name}</strong>
                    <span className="pm-price">{formatPrice(item.priceCents)}</span>
                  </button>
                  <AddButton
                    name={item.name}
                    quantity={selection[item.id] ?? 0}
                    onAdd={() => add(item.id)}
                    className="on-photo"
                  />
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {visibleCategories.map((category) => (
          <section
            key={category.id}
            id={`categorie-${category.id}`}
            className="pm-category"
            data-menu-category={category.id}
            aria-labelledby={`titre-${category.id}`}
          >
            <header>
              {category.eyebrow ? (
                <span className="pm-eyebrow">{category.eyebrow}</span>
              ) : null}
              <h2 id={`titre-${category.id}`}>{category.name}</h2>
            </header>
            {category.items.map((item) => (
              <DishRow
                key={item.id}
                item={item}
                popular={popularBadges.has(item.id)}
                soldOut={soldOut.has(item.id)}
                quantity={selection[item.id] ?? 0}
                onOpen={() => openDish(item.id)}
                onAdd={() => add(item.id)}
              />
            ))}
          </section>
        ))}

        {!categories.length ? (
          <div className="pm-empty-menu">
            <h2>Le menu arrive bientôt.</h2>
          </div>
        ) : !visibleCategories.length ? (
          <div className="pm-empty-menu">
            <h2>Aucun plat ne correspond à vos filtres.</h2>
            <button
              className="pm-btn line"
              type="button"
              onClick={() => setFilter(EMPTY_FILTER)}
            >
              Effacer les filtres
            </button>
          </div>
        ) : null}

        <footer className="pm-footer public-footer">
          <p>
            Allergènes : informations fournies par l’établissement, sur chaque
            plat. En cas d’allergie, prévenez le serveur.
          </p>
          <p>
            {venue.name} · Menu propulsé par{" "}
            <Link href="/">MenuShare</Link>
          </p>
        </footer>
      </div>

      {/* Kept mounted while a panel is open so focus can return to it. */}
      {lines.length > 0 ? (
        <button
          className={`pm-pill ${panel || sheetDish ? "concealed" : ""}`}
          type="button"
          aria-label={`Ouvrir ma sélection : ${count} article${count > 1 ? "s" : ""}, ${formatPrice(totalCents)}`}
          onClick={() => setPanel("selection")}
        >
          <ClipboardList size={17} /> Ma sélection
          <span className="pm-pill-count">{count}</span>
          <span className="pm-pill-total">{formatPrice(totalCents)}</span>
        </button>
      ) : null}

      <div className="pm-toast" role="status" aria-live="polite">
        {toast ? <span>{toast}</span> : null}
      </div>

      {sheetDish ? (
        <DishSheet
          key={sheetDish.id}
          item={sheetDish}
          popular={popularBadges.has(sheetDish.id)}
          soldOut={soldOut.has(sheetDish.id)}
          avoid={filter.avoid}
          quantity={selection[sheetDish.id] ?? 0}
          pairingQuantity={selection[`pairing:${sheetDish.id}`] ?? 0}
          onClose={() => setOpenDishId(null)}
          onCommit={(quantity) => {
            changeQuantity(sheetDish.id, quantity);
            setOpenDishId(null);
            showToast(`${sheetDish.name} × ${quantity} dans ma sélection`);
          }}
          onAddPairing={() => add(`pairing:${sheetDish.id}`)}
        />
      ) : null}

      {panel === "selection" ? (
        <SelectionSheet
          lines={lines}
          totalCents={totalCents}
          onClose={() => setPanel(null)}
          onChange={changeQuantity}
          onShowWaiter={() => setPanel("waiter")}
          onShare={shareSelection}
        />
      ) : null}
      {panel === "waiter" ? (
        <WaiterView
          table={context?.table}
          lines={availableLines}
          soldOutCount={lines.length - availableLines.length}
          onClose={() => setPanel("selection")}
        />
      ) : null}
      {panel === "info" ? (
        <InfoSheet
          venue={venue}
          publishedAt={snapshot.publishedAt}
          now={now}
          onClose={() => setPanel(null)}
          onPlayStory={() => setPanel("story")}
        />
      ) : null}
      {panel === "allergens" ? (
        <AllergenSheet
          filter={filter}
          visibleCount={
            categories
              .flatMap((category) => category.items)
              .filter((item) => !isHiddenByFilter(item, filter)).length
          }
          onChange={(next) => {
            setShowAll(false);
            setFilter(next);
          }}
          onClose={() => setPanel(null)}
        />
      ) : null}
      {panel === "search" ? (
        <SearchSheet
          categories={categories}
          soldOutIds={soldOut}
          popularIds={popularBadges}
          quantities={selection}
          filter={active ? filter : EMPTY_FILTER}
          onClose={() => setPanel(null)}
          onOpen={openDish}
          onAdd={add}
        />
      ) : null}
      {panel === "story" && venue.coverVideo ? (
        <VideoModal
          title={`L’histoire de ${venue.name}`}
          video={venue.coverVideo}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </main>
  );
}
