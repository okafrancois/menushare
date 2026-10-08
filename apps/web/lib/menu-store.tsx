"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type MenuCategory,
  type MenuImage,
  type MenuItem,
  type MenuState,
  type MenuSnapshot,
  type Venue,
  createDemoState,
  createVenueState,
  hydrateMenuState,
  publishMenu,
  reorderById,
  STORAGE_KEY,
  createItem,
  createEmptyState,
} from "@/lib/menu-domain";
import type { ImportRow } from "@/lib/menu-import";

type MaybePromise<T> = T | Promise<T>;

export type VenueChoice = Pick<Venue, "id" | "name" | "slug" | "kind" | "city">;

export type DailySpecialInput = {
  name: string;
  description: string;
  priceCents: number;
  /** New photo as a data URL, `null` to remove it, `undefined` to keep it. */
  imageDataUrl?: string | null;
  endsAt: number;
};

export type MenuStore = {
  state: MenuState;
  hydrated: boolean;
  remote: boolean;
  persistenceError?: string;
  localStates?: MenuState[];
  venues: VenueChoice[];
  selectedVenueId: string;
  selectVenue: (venueId: string) => void;
  canLoadMoreVenues: boolean;
  loadMoreVenues: () => void;
  createVenue: (input: {
    name: string;
    slug: string;
    kind: string;
    city: string;
  }) => MaybePromise<void>;
  updateVenue: (patch: Partial<Venue>) => MaybePromise<void>;
  setTableCount: (tableCount: number) => MaybePromise<void>;
  addCategory: (input: {
    name: string;
    eyebrow: string;
  }) => MaybePromise<string>;
  updateCategory: (
    id: string,
    patch: Partial<MenuCategory>,
  ) => MaybePromise<void>;
  deleteCategory: (id: string) => MaybePromise<void>;
  reorderCategories: (ids: string[]) => MaybePromise<void>;
  addItem: (categoryId: string, item: MenuItem) => MaybePromise<string>;
  updateItem: (
    categoryId: string,
    id: string,
    patch: Partial<MenuItem>,
  ) => MaybePromise<void>;
  deleteItem: (categoryId: string, id: string) => MaybePromise<void>;
  reorderItems: (categoryId: string, ids: string[]) => MaybePromise<void>;
  addItemImage: (
    categoryId: string,
    itemId: string,
    image: MenuImage,
  ) => MaybePromise<void>;
  removeItemImage: (
    categoryId: string,
    itemId: string,
    imageId: string,
  ) => MaybePromise<void>;
  publish: () => MaybePromise<void>;
  setVenueStatus: (status: "draft" | "archived") => MaybePromise<void>;
  restoreVersion: (version: number) => MaybePromise<void>;
  history: MenuSnapshot[];
  importItems: (rows: ImportRow[]) => MaybePromise<void>;
  removeVenue: (confirmName: string) => MaybePromise<void>;
  duplicateItem: (categoryId: string, item: MenuItem) => MaybePromise<void>;
  moveItem: (
    itemId: string,
    fromCategoryId: string,
    toCategoryId: string,
  ) => MaybePromise<void>;
  /** Live: applied to the public menu immediately, without publishing. */
  setSoldOut: (itemId: string, soldOut: boolean) => MaybePromise<void>;
  setAutoRestock: (enabled: boolean) => MaybePromise<void>;
  setDailySpecial: (input: DailySpecialInput) => MaybePromise<void>;
  clearDailySpecial: () => MaybePromise<void>;
  resetDemo: () => MaybePromise<void>;
};

export const MenuStoreContext = createContext<MenuStore | null>(null);

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function MenuStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MenuState>(() => createDemoState());
  const [venueStates, setVenueStates] = useState<Record<string, MenuState>>({});
  const [hydrated, setHydrated] = useState(false);
  const [persistenceError, setPersistenceError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          states?: unknown[];
          selectedVenueId?: string;
        };
        if (Array.isArray(parsed.states)) {
          const states = parsed.states
            .map(hydrateMenuState)
            .filter((entry) => entry.venue.id);
          setVenueStates(
            Object.fromEntries(states.map((entry) => [entry.venue.id, entry])),
          );
          setState(
            states.find((entry) => entry.venue.id === parsed.selectedVenueId) ??
              states[0] ??
              createEmptyState(),
          );
        } else {
          setState(hydrateMenuState(parsed));
        }
      }
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* Restricted browser storage. */
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const states = { ...venueStates, [state.venue.id]: state };
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          states: Object.values(states).filter((entry) => entry.venue.id),
          selectedVenueId: state.venue.id,
        }),
      );
      setPersistenceError("");
    } catch {
      setPersistenceError(
        "Le navigateur ne peut plus enregistrer vos essais. Exportez vos données avant de fermer cette page.",
      );
    }
  }, [hydrated, state, venueStates]);

  const store = useMemo<MenuStore>(() => {
    const touch = (next: MenuState): MenuState => ({
      ...next,
      changedAt: Date.now(),
    });
    return {
      state,
      persistenceError,
      removeVenue(confirmName) {
        if (confirmName !== state.venue.name) throw new Error("CONFIRM_NAME");
        const remaining = { ...venueStates };
        delete remaining[state.venue.id];
        setVenueStates(remaining);
        setState(Object.values(remaining)[0] ?? createEmptyState());
      },
      importItems(rows) {
        const categories = structuredClone(state.categories);
        for (const row of rows) {
          let category = categories.find(
            (c) =>
              c.name.toLocaleLowerCase("fr-FR") ===
              row.category.toLocaleLowerCase("fr-FR"),
          );
          if (!category) {
            if (categories.length >= 100)
              throw new Error("CATEGORY_LIMIT_REACHED");
            category = {
              id: uid("category"),
              name: row.category,
              eyebrow: "",
              items: [],
            };
            categories.push(category);
          }
          if (category.items.length >= 200)
            throw new Error("ITEM_LIMIT_REACHED");
          category.items.push(
            createItem({
              id: uid("item"),
              name: row.name,
              description: row.description,
              price: String(row.priceCents / 100),
            }),
          );
        }
        setState(touch({ ...state, categories }));
      },
      history: [state.published, ...(state.history ?? [])].filter(
        (entry): entry is MenuSnapshot => Boolean(entry),
      ),
      setVenueStatus: (status) =>
        setState((current) => ({
          ...current,
          venue: { ...current.venue, status },
        })),
      restoreVersion: (version) =>
        setState((current) => {
          const snapshot = [current.published, ...(current.history ?? [])].find(
            (entry) => entry?.version === version,
          );
          if (!snapshot) throw new Error("VERSION_NOT_FOUND");
          return touch({
            ...current,
            categories: structuredClone(snapshot.categories),
            venue: {
              ...structuredClone(snapshot.venue),
              id: current.venue.id,
              slug: current.venue.slug,
              status: current.venue.status,
              tableCount: current.venue.tableCount,
            },
          });
        }),
      duplicateItem: (categoryId, item) => {
        if (
          (state.categories.find((c) => c.id === categoryId)?.items.length ??
            0) >= 200
        )
          throw new Error("ITEM_LIMIT_REACHED");
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? {
                    ...category,
                    items: [
                      ...category.items,
                      {
                        ...structuredClone(item),
                        id: uid("item"),
                        name: `${item.name} (copie)`,
                        images: item.images.map((image) => ({
                          ...image,
                          id: uid("image"),
                        })),
                      },
                    ],
                  }
                : category,
            ),
          }),
        );
      },
      moveItem: (itemId, fromCategoryId, toCategoryId) => {
        const target = state.categories.find((c) => c.id === toCategoryId);
        if (!target) throw new Error("NOT_FOUND");
        if (fromCategoryId !== toCategoryId && target.items.length >= 200)
          throw new Error("ITEM_LIMIT_REACHED");
        setState((current) => {
          const item = current.categories
            .find((c) => c.id === fromCategoryId)
            ?.items.find((i) => i.id === itemId);
          if (!item || fromCategoryId === toCategoryId) return current;
          return touch({
            ...current,
            categories: current.categories.map((c) =>
              c.id === fromCategoryId
                ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
                : c.id === toCategoryId
                  ? { ...c, items: [...c.items, item] }
                  : c,
            ),
          });
        });
      },
      hydrated,
      remote: false,
      localStates: Object.values({
        ...venueStates,
        [state.venue.id]: state,
      }).filter((entry) => entry.venue.id),
      venues: Object.values({
        ...venueStates,
        [state.venue.id]: state,
      })
        .filter((entry) => entry.venue.id)
        .map((entry) => entry.venue),
      selectedVenueId: state.venue.id,
      selectVenue: (venueId) => {
        if (venueId === state.venue.id) return;
        const next = venueStates[venueId];
        if (next) {
          setVenueStates((current) => ({
            ...current,
            [state.venue.id]: state,
          }));
          setState(next);
        }
      },
      canLoadMoreVenues: false,
      loadMoreVenues: () => undefined,
      createVenue: (input) => {
        const next = createVenueState({ id: uid("venue"), ...input });
        setVenueStates((current) => ({
          ...current,
          [state.venue.id]: state,
          [next.venue.id]: next,
        }));
        setState(next);
      },
      updateVenue: (patch) =>
        setState((current) => {
          const next = touch({
            ...current,
            venue: { ...current.venue, ...patch },
          });
          if (patch.slug && patch.slug !== current.venue.slug)
            next.previousSlugs = [
              ...new Set([
                ...(current.previousSlugs ?? []),
                current.venue.slug,
              ]),
            ];
          // Like the server, a new menu address applies to the live menu
          // immediately instead of waiting for the next publication.
          if (patch.slug && next.published && patch.slug !== current.venue.slug)
            next.published = {
              ...next.published,
              venue: { ...next.published.venue, slug: patch.slug },
            };
          return next;
        }),
      // Tables only affect printed QR codes, so the menu stays published.
      setTableCount: (tableCount) =>
        setState((current) => ({
          ...current,
          venue: { ...current.venue, tableCount },
        })),
      addCategory: (input) => {
        if (state.categories.length >= 100)
          throw new Error("CATEGORY_LIMIT_REACHED");
        const id = uid("category");
        setState((current) =>
          touch({
            ...current,
            categories: [
              ...current.categories,
              {
                id,
                name: input.name.trim(),
                eyebrow: input.eyebrow.trim(),
                items: [],
              },
            ],
          }),
        );
        return id;
      },
      updateCategory: (id, patch) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === id ? { ...category, ...patch, id } : category,
            ),
          }),
        ),
      deleteCategory: (id) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.filter(
              (category) => category.id !== id,
            ),
          }),
        ),
      reorderCategories: (ids) =>
        setState((current) =>
          touch({
            ...current,
            categories: reorderById(current.categories, ids),
          }),
        ),
      addItem: (categoryId, item) => {
        if (
          (state.categories.find((category) => category.id === categoryId)
            ?.items.length ?? 0) >= 200
        )
          throw new Error("ITEM_LIMIT_REACHED");
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? { ...category, items: [...category.items, item] }
                : category,
            ),
          }),
        );
        return item.id;
      },
      updateItem: (categoryId, id, patch) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? {
                    ...category,
                    items: category.items.map((item) =>
                      item.id === id ? { ...item, ...patch, id } : item,
                    ),
                  }
                : category,
            ),
          }),
        ),
      deleteItem: (categoryId, id) =>
        setState((current) =>
          touch({
            ...current,
            live: {
              ...current.live,
              soldOutIds: current.live.soldOutIds.filter(
                (soldOutId) => soldOutId !== id,
              ),
            },
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? {
                    ...category,
                    items: category.items.filter((item) => item.id !== id),
                  }
                : category,
            ),
          }),
        ),
      reorderItems: (categoryId, ids) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? { ...category, items: reorderById(category.items, ids) }
                : category,
            ),
          }),
        ),
      addItemImage: (categoryId, itemId, image) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? {
                    ...category,
                    items: category.items.map((item) =>
                      item.id === itemId
                        ? { ...item, images: [...item.images, image] }
                        : item,
                    ),
                  }
                : category,
            ),
          }),
        ),
      removeItemImage: (categoryId, itemId, imageId) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? {
                    ...category,
                    items: category.items.map((item) =>
                      item.id === itemId
                        ? {
                            ...item,
                            images: item.images.filter(
                              (image) => image.id !== imageId,
                            ),
                          }
                        : item,
                    ),
                  }
                : category,
            ),
          }),
        ),
      publish: () => setState((current) => publishMenu(current)),
      // Live service data is not part of the draft: `changedAt` is untouched.
      setSoldOut: (itemId, soldOut) =>
        setState((current) => ({
          ...current,
          live: {
            ...current.live,
            soldOutIds: soldOut
              ? [...new Set([...current.live.soldOutIds, itemId])]
              : current.live.soldOutIds.filter((id) => id !== itemId),
          },
        })),
      setAutoRestock: (enabled) =>
        setState((current) => ({
          ...current,
          live: { ...current.live, autoRestock: enabled },
        })),
      setDailySpecial: (input) =>
        setState((current) => ({
          ...current,
          live: {
            ...current.live,
            special: {
              id: current.live.special?.id ?? uid("special"),
              name: input.name.trim(),
              description: input.description.trim(),
              priceCents: input.priceCents,
              imageUrl:
                input.imageDataUrl === undefined
                  ? current.live.special?.imageUrl
                  : (input.imageDataUrl ?? undefined),
              endsAt: input.endsAt,
            },
          },
        })),
      clearDailySpecial: () =>
        setState((current) => ({
          ...current,
          live: { ...current.live, special: undefined },
        })),
      resetDemo: () => {
        const demo = createDemoState(Date.now());
        setVenueStates({ [demo.venue.id]: demo });
        setState(demo);
      },
    };
  }, [hydrated, state, venueStates, persistenceError]);

  return (
    <MenuStoreContext.Provider value={store}>
      {children}
    </MenuStoreContext.Provider>
  );
}

export function useMenuStore() {
  const value = useContext(MenuStoreContext);
  if (!value)
    throw new Error("useMenuStore must be used inside MenuStoreProvider");
  return value;
}
