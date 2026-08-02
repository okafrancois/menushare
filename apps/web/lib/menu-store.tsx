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

export type MenuStore = {
  state: MenuState;
  hydrated: boolean;
  remote: boolean;
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(hydrateMenuState(JSON.parse(raw)));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const store = useMemo<MenuStore>(() => {
    const touch = (next: MenuState): MenuState => ({
      ...next,
      changedAt: Date.now(),
    });
    return {
      state,
      hydrated,
      remote: false,
      createVenue: (input) =>
        setState(createVenueState({ id: uid("venue"), ...input })),
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
      resetDemo: () => setState(createDemoState(Date.now())),
    };
  }, [hydrated, state]);

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
