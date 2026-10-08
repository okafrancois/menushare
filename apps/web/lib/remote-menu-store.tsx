"use client";

import { api } from "@repo/backend/api";
import type { Id } from "@repo/backend/data-model";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  createEmptyState,
  emptyLiveService,
  videoToUrl,
  type LiveService,
  type MenuState,
} from "@/lib/menu-domain";
import {
  toCategories,
  toDailySpecial,
  toMenuSnapshot,
  toVenue,
} from "@/lib/menu-snapshot";
import { MenuStoreContext, type MenuStore } from "@/lib/menu-store";

const SELECTED_VENUE_KEY = "menushare.selectedVenue.v1";

function hasOwn<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function RemoteMenuStoreProvider({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  const {
    results: venues,
    status: venuesStatus,
    loadMore: loadMoreVenues,
  } = usePaginatedQuery(
    api.venues.listMinePaginated,
    auth.isAuthenticated ? {} : "skip",
    { initialNumItems: 25 },
  );
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const workspace =
    venues.find(({ venue }) => venue._id === selectedVenueId) ?? venues[0];
  const menuId = workspace?.menuId;
  const venueId = workspace?.venue._id;
  const draft = useQuery(api.menus.getDraft, menuId ? { menuId } : "skip");
  const publishedPayload = useQuery(
    api.menus.getPublishedSnapshot,
    menuId ? { menuId } : "skip",
  );
  const service = useQuery(
    api.service.getServiceState,
    venueId ? { venueId } : "skip",
  );

  useEffect(() => {
    const stored = localStorage.getItem(SELECTED_VENUE_KEY);
    if (stored) setSelectedVenueId(stored);
  }, []);

  useEffect(() => {
    if (!workspace || workspace.venue._id === selectedVenueId) return;
    setSelectedVenueId(workspace.venue._id);
    localStorage.setItem(SELECTED_VENUE_KEY, workspace.venue._id);
  }, [selectedVenueId, workspace]);

  const createVenueMutation = useMutation(api.venues.create);
  const updateProfile = useMutation(api.venues.updateProfile);
  const updateAppearance = useMutation(api.venues.updateAppearance);
  const changeSlug = useMutation(api.venues.changeSlug);
  const setTableCountMutation = useMutation(api.venues.setTableCount);
  const generateImageUploadUrl = useMutation(api.venues.generateImageUploadUrl);
  const addCategoryMutation = useMutation(api.menus.addCategory);
  const updateCategoryMutation = useMutation(api.menus.updateCategory);
  const deleteCategoryMutation = useMutation(api.menus.deleteCategory);
  const reorderCategoriesMutation = useMutation(api.menus.reorderCategories);
  const addItemMutation = useMutation(api.menus.addItem);
  const updateItemMutation = useMutation(api.menus.updateItem);
  const deleteItemMutation = useMutation(api.menus.deleteItem);
  const reorderItemsMutation = useMutation(api.menus.reorderItems);
  const setExternalVideo = useMutation(api.menus.setExternalVideo);
  const removeExternalVideo = useMutation(api.menus.removeExternalVideo);
  const addItemImageMutation = useMutation(api.menus.addItemImage);
  const removeMedia = useMutation(api.menus.removeMedia);
  const publishMutation = useMutation(api.menus.publish);
  const setSoldOutMutation = useMutation(api.service.setSoldOut);
  const setAutoRestockMutation = useMutation(api.service.setAutoRestock);
  const setDailySpecialMutation = useMutation(api.service.setDailySpecial);
  const clearDailySpecialMutation = useMutation(api.service.clearDailySpecial);

  const live = useMemo<LiveService>(() => {
    if (!service) return emptyLiveService();
    return {
      soldOutIds: service.soldOutItemIds.map(String),
      autoRestock: service.autoRestock,
      special: toDailySpecial(service.special),
    };
  }, [service]);

  const state = useMemo<MenuState>(() => {
    if (!draft) return createEmptyState();
    const venue = toVenue(draft.venue);
    const categories = toCategories(draft.categories);
    const snapshot = toMenuSnapshot(publishedPayload);
    const publishedAt = draft.menu.publishedAt;
    return {
      venue,
      categories,
      changedAt: draft.menu.updatedAt,
      published:
        snapshot && publishedAt
          ? { ...snapshot, publishedAt, version: draft.menu.version }
          : undefined,
      live,
    };
  }, [draft, live, publishedPayload]);

  const hydrated =
    !auth.isLoading &&
    (!auth.isAuthenticated ||
      (venuesStatus !== "LoadingFirstPage" &&
        (!menuId ||
          (draft !== undefined &&
            publishedPayload !== undefined &&
            service !== undefined))));

  const store = useMemo<MenuStore>(() => {
    const currentVenueId = () => {
      const id = state.venue.id as Id<"venues">;
      if (!id) throw new Error("VENUE_NOT_FOUND");
      return id;
    };

    async function uploadImage(dataUrl: string) {
      const uploadUrl = await generateImageUploadUrl({
        venueId: currentVenueId(),
      });
      const blob = await (await fetch(dataUrl)).blob();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });
      if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
      const result = (await response.json()) as { storageId?: string };
      if (!result.storageId) throw new Error("IMAGE_UPLOAD_FAILED");
      return result.storageId as Id<"_storage">;
    }

    return {
      state,
      hydrated,
      remote: true,
      venues: venues.map(({ venue }) => ({
        id: venue._id,
        name: venue.name,
        slug: venue.slug,
        kind: venue.kind,
        city: venue.city ?? "",
      })),
      selectedVenueId: workspace?.venue._id ?? "",
      selectVenue(nextVenueId) {
        setSelectedVenueId(nextVenueId);
        localStorage.setItem(SELECTED_VENUE_KEY, nextVenueId);
      },
      canLoadMoreVenues: venuesStatus === "CanLoadMore",
      loadMoreVenues() {
        if (venuesStatus === "CanLoadMore") loadMoreVenues(25);
      },
      async createVenue(input) {
        const created = await createVenueMutation({
          name: input.name,
          kind: input.kind,
          requestedSlug: input.slug,
          city: input.city || undefined,
        });
        setSelectedVenueId(created.venueId);
        localStorage.setItem(SELECTED_VENUE_KEY, created.venueId);
      },
      async updateVenue(patch) {
        const id = currentVenueId();
        if (patch.slug && patch.slug !== state.venue.slug) {
          await changeSlug({ venueId: id, requestedSlug: patch.slug });
        }
        const profileKeys = [
          "name",
          "kind",
          "city",
          "tagline",
          "description",
          "phone",
          "address",
          "hours",
          "openingHours",
        ] as const;
        if (profileKeys.some((key) => hasOwn(patch, key))) {
          await updateProfile({
            venueId: id,
            name: patch.name,
            kind: patch.kind,
            city: patch.city,
            tagline: patch.tagline,
            description: patch.description,
            phone: patch.phone,
            address: patch.address,
            hours: patch.hours,
            openingHours: patch.openingHours,
          });
        }

        const appearance: Parameters<typeof updateAppearance>[0] = {
          venueId: id,
        };
        if (patch.accentColor !== undefined)
          appearance.accentColor = patch.accentColor;
        if (
          hasOwn(patch, "logoDataUrl") &&
          patch.logoDataUrl !== state.venue.logoDataUrl
        ) {
          if (patch.logoDataUrl)
            appearance.logoStorageId = await uploadImage(patch.logoDataUrl);
          else appearance.removeLogo = true;
        }
        if (
          hasOwn(patch, "coverImageDataUrl") &&
          patch.coverImageDataUrl !== state.venue.coverImageDataUrl
        ) {
          if (patch.coverImageDataUrl)
            appearance.coverImageStorageId = await uploadImage(
              patch.coverImageDataUrl,
            );
          else appearance.removeCoverImage = true;
        }
        if (
          hasOwn(patch, "coverVideo") &&
          patch.coverVideo?.embedUrl !== state.venue.coverVideo?.embedUrl
        ) {
          if (patch.coverVideo)
            appearance.coverVideoUrl = videoToUrl(patch.coverVideo);
          else appearance.removeCoverVideo = true;
        }
        if (Object.keys(appearance).length > 1) {
          await updateAppearance(appearance);
        }
      },
      async addCategory(input) {
        if (!menuId) throw new Error("MENU_NOT_FOUND");
        return await addCategoryMutation({
          menuId,
          name: input.name,
          eyebrow: input.eyebrow || undefined,
        });
      },
      async updateCategory(id, patch) {
        await updateCategoryMutation({
          categoryId: id as Id<"categories">,
          name: patch.name,
          eyebrow: patch.eyebrow,
        });
      },
      async deleteCategory(id) {
        await deleteCategoryMutation({ categoryId: id as Id<"categories"> });
      },
      async reorderCategories(ids) {
        if (!menuId) throw new Error("MENU_NOT_FOUND");
        await reorderCategoriesMutation({
          menuId,
          categoryIds: ids as Id<"categories">[],
        });
      },
      async addItem(categoryId, item) {
        const itemId = await addItemMutation({
          categoryId: categoryId as Id<"categories">,
          name: item.name,
          description: item.description || undefined,
          details: item.details || undefined,
          priceCents: item.priceCents,
          ingredients: item.ingredients.length ? item.ingredients : undefined,
          allergens: item.allergens,
          tags: item.tags,
          pairingName: item.pairingName || undefined,
          pairingPriceCents: item.pairingPriceCents,
          reviewRating: item.reviewRating,
          reviewCount: item.reviewCount,
          reviewQuote: item.reviewQuote || undefined,
          reviewAuthor: item.reviewAuthor || undefined,
        });
        if (item.video) {
          await setExternalVideo({ itemId, url: videoToUrl(item.video) });
        }
        return itemId;
      },
      async updateItem(_categoryId, id, patch) {
        const itemId = id as Id<"menuItems">;
        // Absent key = unchanged; key present but empty = cleared (null).
        const clearable = <K extends keyof typeof patch>(key: K) =>
          hasOwn(patch, key) ? (patch[key] ?? null) : undefined;
        await updateItemMutation({
          itemId,
          name: patch.name,
          description: patch.description,
          details: patch.details,
          priceCents: patch.priceCents,
          active: patch.available,
          ingredients: patch.ingredients,
          allergens: clearable("allergens") as string[] | null | undefined,
          tags: patch.tags,
          pairingName: patch.pairingName,
          pairingPriceCents: clearable("pairingPriceCents") as
            | number
            | null
            | undefined,
          reviewRating: clearable("reviewRating") as number | null | undefined,
          reviewCount: clearable("reviewCount") as number | null | undefined,
          reviewQuote: patch.reviewQuote,
          reviewAuthor: patch.reviewAuthor,
        });
        if (hasOwn(patch, "video")) {
          if (patch.video) {
            await setExternalVideo({ itemId, url: videoToUrl(patch.video) });
          } else {
            await removeExternalVideo({ itemId });
          }
        }
      },
      async deleteItem(_categoryId, id) {
        await deleteItemMutation({ itemId: id as Id<"menuItems"> });
      },
      async reorderItems(categoryId, ids) {
        await reorderItemsMutation({
          categoryId: categoryId as Id<"categories">,
          itemIds: ids as Id<"menuItems">[],
        });
      },
      async addItemImage(_categoryId, itemId, image) {
        const storageId = await uploadImage(image.dataUrl);
        await addItemImageMutation({
          itemId: itemId as Id<"menuItems">,
          storageId,
          alt: image.alt || undefined,
        });
      },
      async removeItemImage(_categoryId, _itemId, imageId) {
        await removeMedia({ mediaId: imageId as Id<"media"> });
      },
      async setTableCount(tableCount) {
        await setTableCountMutation({ venueId: currentVenueId(), tableCount });
      },
      async publish() {
        if (!menuId) throw new Error("MENU_NOT_FOUND");
        await publishMutation({ menuId });
      },
      async setSoldOut(itemId, soldOut) {
        await setSoldOutMutation({
          itemId: itemId as Id<"menuItems">,
          soldOut,
        });
      },
      async setAutoRestock(enabled) {
        await setAutoRestockMutation({ venueId: currentVenueId(), enabled });
      },
      async setDailySpecial(input) {
        const imageStorageId =
          input.imageDataUrl === undefined
            ? (state.live.special?.imageStorageId as Id<"_storage"> | undefined)
            : input.imageDataUrl
              ? await uploadImage(input.imageDataUrl)
              : undefined;
        await setDailySpecialMutation({
          venueId: currentVenueId(),
          name: input.name,
          description: input.description || undefined,
          priceCents: input.priceCents,
          imageStorageId,
          endsAt: input.endsAt,
        });
      },
      async clearDailySpecial() {
        await clearDailySpecialMutation({ venueId: currentVenueId() });
      },
      async resetDemo() {
        throw new Error("RESET_NOT_AVAILABLE_IN_PRODUCTION");
      },
    };
  }, [
    addCategoryMutation,
    addItemImageMutation,
    addItemMutation,
    changeSlug,
    clearDailySpecialMutation,
    createVenueMutation,
    deleteCategoryMutation,
    deleteItemMutation,
    generateImageUploadUrl,
    hydrated,
    loadMoreVenues,
    menuId,
    publishMutation,
    removeExternalVideo,
    removeMedia,
    reorderCategoriesMutation,
    reorderItemsMutation,
    setAutoRestockMutation,
    setDailySpecialMutation,
    setExternalVideo,
    setSoldOutMutation,
    setTableCountMutation,
    state,
    updateAppearance,
    updateCategoryMutation,
    updateItemMutation,
    updateProfile,
    venues,
    venuesStatus,
    workspace?.venue._id,
  ]);

  return (
    <MenuStoreContext.Provider value={store}>
      {children}
    </MenuStoreContext.Provider>
  );
}
