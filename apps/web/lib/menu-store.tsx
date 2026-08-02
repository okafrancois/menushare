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
  type Venue,
  createDemoState,
  createVenueState,
  hydrateMenuState,
  move,
  publishMenu,
  STORAGE_KEY,
} from "@/lib/menu-domain";

type MaybePromise<T> = T | Promise<T>;

export type VenueChoice = Pick<Venue, "id" | "name" | "slug" | "kind" | "city">;

export type MenuStore = {
  state: MenuState;
  hydrated: boolean;
  remote: boolean;
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
  addCategory: (input: {
    name: string;
    eyebrow: string;
  }) => MaybePromise<string>;
  updateCategory: (
    id: string,
    patch: Partial<MenuCategory>,
  ) => MaybePromise<void>;
  deleteCategory: (id: string) => MaybePromise<void>;
  moveCategory: (id: string, direction: -1 | 1) => MaybePromise<void>;
  addItem: (categoryId: string, item: MenuItem) => MaybePromise<void>;
  updateItem: (
    categoryId: string,
    id: string,
    patch: Partial<MenuItem>,
  ) => MaybePromise<void>;
  deleteItem: (categoryId: string, id: string) => MaybePromise<void>;
  moveItem: (
    categoryId: string,
    id: string,
    direction: -1 | 1,
  ) => MaybePromise<void>;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          states?: unknown[];
          selectedVenueId?: string;
        };
        if (Array.isArray(parsed.states) && parsed.states.length > 0) {
          const states = parsed.states.map(hydrateMenuState);
          setVenueStates(
            Object.fromEntries(states.map((entry) => [entry.venue.id, entry])),
          );
          setState(
            states.find((entry) => entry.venue.id === parsed.selectedVenueId) ??
              states[0],
          );
        } else {
          setState(hydrateMenuState(parsed));
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const states = { ...venueStates, [state.venue.id]: state };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        states: Object.values(states),
        selectedVenueId: state.venue.id,
      }),
    );
  }, [hydrated, state, venueStates]);

  const store = useMemo<MenuStore>(() => {
    const touch = (next: MenuState): MenuState => ({
      ...next,
      changedAt: Date.now(),
    });
    return {
      state,
      hydrated,
      remote: false,
      venues: Object.values({
        ...venueStates,
        [state.venue.id]: state,
      }).map((entry) => entry.venue),
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
        setState((current) =>
          touch({ ...current, venue: { ...current.venue, ...patch } }),
        ),
      addCategory: (input) => {
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
      moveCategory: (id, direction) =>
        setState((current) => {
          const index = current.categories.findIndex(
            (category) => category.id === id,
          );
          return touch({
            ...current,
            categories: move(current.categories, index, index + direction),
          });
        }),
      addItem: (categoryId, item) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) =>
              category.id === categoryId
                ? { ...category, items: [...category.items, item] }
                : category,
            ),
          }),
        ),
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
      moveItem: (categoryId, id, direction) =>
        setState((current) =>
          touch({
            ...current,
            categories: current.categories.map((category) => {
              if (category.id !== categoryId) return category;
              const index = category.items.findIndex((item) => item.id === id);
              return {
                ...category,
                items: move(category.items, index, index + direction),
              };
            }),
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
      resetDemo: () => {
        const demo = createDemoState(Date.now());
        setVenueStates({ [demo.venue.id]: demo });
        setState(demo);
      },
    };
  }, [hydrated, state, venueStates]);

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
