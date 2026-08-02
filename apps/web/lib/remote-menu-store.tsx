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
  move,
  type ExternalVideo,
  type MenuCategory,
  type MenuImage,
  type MenuItem,
  type MenuState,
  type Venue,
} from "@/lib/menu-domain";
import { MenuStoreContext, type MenuStore } from "@/lib/menu-store";

function videoUrl(video: ExternalVideo) {
  return video.provider === "youtube"
    ? `https://youtu.be/${video.externalId}`
    : `https://vimeo.com/${video.externalId}`;
}

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
  const draft = useQuery(api.menus.getDraft, menuId ? { menuId } : "skip");

  useEffect(() => {
    const stored = localStorage.getItem("menushare.selectedVenue.v1");
    if (stored) setSelectedVenueId(stored);
  }, []);

  useEffect(() => {
    if (!workspace || workspace.venue._id === selectedVenueId) return;
    setSelectedVenueId(workspace.venue._id);
    localStorage.setItem("menushare.selectedVenue.v1", workspace.venue._id);
  }, [selectedVenueId, workspace]);

  const createVenueMutation = useMutation(api.venues.create);
  const updateProfile = useMutation(api.venues.updateProfile);
  const updateAppearance = useMutation(api.venues.updateAppearance);
  const changeSlug = useMutation(api.venues.changeSlug);
  const generateImageUploadUrl = useMutation(api.venues.generateImageUploadUrl);
  const addCategoryMutation = useMutation(api.menus.addCategory);
  const updateCategoryMutation = useMutation(api.menus.updateCategory);
  const deleteCategoryMutation = useMutation(api.menus.deleteCategory);
  const reorderCategories = useMutation(api.menus.reorderCategories);
  const addItemMutation = useMutation(api.menus.addItem);
  const updateItemMutation = useMutation(api.menus.updateItem);
  const deleteItemMutation = useMutation(api.menus.deleteItem);
  const reorderItems = useMutation(api.menus.reorderItems);
  const setExternalVideo = useMutation(api.menus.setExternalVideo);
  const removeExternalVideo = useMutation(api.menus.removeExternalVideo);
  const addItemImageMutation = useMutation(api.menus.addItemImage);
  const removeMedia = useMutation(api.menus.removeMedia);
  const publishMutation = useMutation(api.menus.publish);

  const state = useMemo<MenuState>(() => {
    if (!draft) return createEmptyState();

    const venue: Venue = {
      id: draft.venue._id,
      slug: draft.venue.slug,
      name: draft.venue.name,
      kind: draft.venue.kind,
      city: draft.venue.city ?? "",
      tagline: draft.venue.tagline ?? "",
      description: draft.venue.description ?? "",
      address: draft.venue.address ?? "",
      phone: draft.venue.phone ?? "",
      hours: draft.venue.hours ?? "",
      accentColor: draft.venue.accentColor ?? "#76263c",
      logoDataUrl: draft.venue.logoUrl ?? undefined,
      coverImageDataUrl: draft.venue.coverImageUrl ?? undefined,
      coverVideo:
        draft.venue.coverVideoProvider &&
        draft.venue.coverVideoExternalId &&
        draft.venue.coverVideoEmbedUrl
          ? {
              provider: draft.venue.coverVideoProvider,
              externalId: draft.venue.coverVideoExternalId,
              embedUrl: draft.venue.coverVideoEmbedUrl,
            }
          : undefined,
    };

    const categories: MenuCategory[] = draft.categories.map((category) => ({
      id: category._id,
      name: category.name,
      eyebrow: category.eyebrow ?? "",
      items: category.items.map((item) => {
        const video = item.media.find(
          (asset) =>
            asset.kind === "externalVideo" &&
            asset.provider &&
            asset.externalId &&
            asset.embedUrl,
        );
        return {
          id: item._id,
          name: item.name,
          description: item.description ?? "",
          details: item.details ?? "",
          priceCents: item.priceCents,
          available: item.active,
          images: item.media
            .filter((asset) => asset.kind === "image" && asset.imageUrl)
            .map((asset) => ({
              id: asset._id,
              dataUrl: asset.imageUrl!,
              alt: asset.alt ?? item.name,
            })),
          video:
            video?.provider && video.externalId && video.embedUrl
              ? {
                  provider: video.provider,
                  externalId: video.externalId,
                  embedUrl: video.embedUrl,
                }
              : undefined,
          ingredients: item.ingredients ?? [],
          pairingName: item.pairingName ?? "",
          pairingPriceCents: item.pairingPriceCents,
          reviewRating: item.reviewRating,
          reviewCount: item.reviewCount,
          reviewQuote: item.reviewQuote ?? "",
          reviewAuthor: item.reviewAuthor ?? "",
        } satisfies MenuItem;
      }),
    }));

    const publishedAt = draft.menu.publishedAt;
    return {
      venue,
      categories,
      changedAt: draft.menu.updatedAt,
      published: publishedAt
        ? {
            venue,
            categories,
            publishedAt,
            version: draft.menu.version,
          }
        : undefined,
    };
  }, [draft]);

  const hydrated =
    !auth.isLoading &&
    (!auth.isAuthenticated ||
      (venuesStatus !== "LoadingFirstPage" &&
        (!menuId || draft !== undefined)));

  const store = useMemo<MenuStore>(
    () => ({
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
      selectVenue(venueId) {
        setSelectedVenueId(venueId);
        localStorage.setItem("menushare.selectedVenue.v1", venueId);
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
        localStorage.setItem("menushare.selectedVenue.v1", created.venueId);
      },
      async updateVenue(patch) {
        const venueId = state.venue.id as Id<"venues">;
        if (!venueId) throw new Error("VENUE_NOT_FOUND");

        if (patch.slug && patch.slug !== state.venue.slug) {
          await changeSlug({ venueId, requestedSlug: patch.slug });
        }

        await updateProfile({
          venueId,
          name: patch.name,
          kind: patch.kind,
          city: patch.city,
          tagline: patch.tagline,
          description: patch.description,
          phone: patch.phone,
          address: patch.address,
          hours: patch.hours,
        });

        const appearance: {
          venueId: Id<"venues">;
          accentColor?: string;
          logoStorageId?: Id<"_storage">;
          coverImageStorageId?: Id<"_storage">;
          coverVideoUrl?: string;
          removeLogo?: boolean;
          removeCoverImage?: boolean;
          removeCoverVideo?: boolean;
        } = { venueId };

        if (patch.accentColor !== undefined) {
          appearance.accentColor = patch.accentColor;
        }

        async function uploadImage(dataUrl: string) {
          const uploadUrl = await generateImageUploadUrl({ venueId });
          const blob = await (await fetch(dataUrl)).blob();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": blob.type || "application/octet-stream",
            },
            body: blob,
          });
          if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
          const result = (await response.json()) as { storageId?: string };
          if (!result.storageId) throw new Error("IMAGE_UPLOAD_FAILED");
          return result.storageId as Id<"_storage">;
        }

        if (
          hasOwn(patch, "logoDataUrl") &&
          patch.logoDataUrl !== state.venue.logoDataUrl
        ) {
          if (patch.logoDataUrl) {
            appearance.logoStorageId = await uploadImage(patch.logoDataUrl);
          } else {
            appearance.removeLogo = true;
          }
        }
        if (
          hasOwn(patch, "coverImageDataUrl") &&
          patch.coverImageDataUrl !== state.venue.coverImageDataUrl
        ) {
          if (patch.coverImageDataUrl) {
            appearance.coverImageStorageId = await uploadImage(
              patch.coverImageDataUrl,
            );
          } else {
            appearance.removeCoverImage = true;
          }
        }
        if (
          hasOwn(patch, "coverVideo") &&
          patch.coverVideo?.embedUrl !== state.venue.coverVideo?.embedUrl
        ) {
          if (patch.coverVideo) {
            appearance.coverVideoUrl = videoUrl(patch.coverVideo);
          } else {
            appearance.removeCoverVideo = true;
          }
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
      async moveCategory(id, direction) {
        if (!menuId) throw new Error("MENU_NOT_FOUND");
        const index = state.categories.findIndex(
          (category) => category.id === id,
        );
        const next = move(state.categories, index, index + direction);
        await reorderCategories({
          menuId,
          categoryIds: next.map((category) => category.id as Id<"categories">),
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
          pairingName: item.pairingName || undefined,
          pairingPriceCents: item.pairingPriceCents,
          reviewRating: item.reviewRating,
          reviewCount: item.reviewCount,
          reviewQuote: item.reviewQuote || undefined,
          reviewAuthor: item.reviewAuthor || undefined,
        });
        if (item.video) {
          await setExternalVideo({ itemId, url: videoUrl(item.video) });
        }
        return itemId;
      },
      async updateItem(_categoryId, id, patch) {
        const itemId = id as Id<"menuItems">;
        await updateItemMutation({
          itemId,
          name: patch.name,
          description: patch.description,
          details: patch.details,
          priceCents: patch.priceCents,
          active: patch.available,
          ingredients: patch.ingredients,
          pairingName: patch.pairingName,
          pairingPriceCents: patch.pairingPriceCents,
          reviewRating: patch.reviewRating,
          reviewCount: patch.reviewCount,
          reviewQuote: patch.reviewQuote,
          reviewAuthor: patch.reviewAuthor,
        });
        if (hasOwn(patch, "video")) {
          if (patch.video) {
            await setExternalVideo({ itemId, url: videoUrl(patch.video) });
          } else {
            await removeExternalVideo({ itemId });
          }
        }
      },
      async deleteItem(_categoryId, id) {
        await deleteItemMutation({ itemId: id as Id<"menuItems"> });
      },
      async moveItem(categoryId, id, direction) {
        const category = state.categories.find(
          (candidate) => candidate.id === categoryId,
        );
        if (!category) throw new Error("CATEGORY_NOT_FOUND");
        const index = category.items.findIndex((item) => item.id === id);
        const next = move(category.items, index, index + direction);
        await reorderItems({
          categoryId: categoryId as Id<"categories">,
          itemIds: next.map((item) => item.id as Id<"menuItems">),
        });
      },
      async addItemImage(_categoryId, itemId, image) {
        const venueId = state.venue.id as Id<"venues">;
        const uploadUrl = await generateImageUploadUrl({ venueId });
        const blob = await (await fetch(image.dataUrl)).blob();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "application/octet-stream" },
          body: blob,
        });
        if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
        const result = (await response.json()) as { storageId?: string };
        if (!result.storageId) throw new Error("IMAGE_UPLOAD_FAILED");
        await addItemImageMutation({
          itemId: itemId as Id<"menuItems">,
          storageId: result.storageId as Id<"_storage">,
          alt: image.alt || undefined,
        });
      },
      async removeItemImage(_categoryId, _itemId, imageId) {
        await removeMedia({ mediaId: imageId as Id<"media"> });
      },
      async publish() {
        if (!menuId) throw new Error("MENU_NOT_FOUND");
        await publishMutation({ menuId });
      },
      async resetDemo() {
        throw new Error("RESET_NOT_AVAILABLE_IN_PRODUCTION");
      },
    }),
    [
      addCategoryMutation,
      addItemImageMutation,
      addItemMutation,
      changeSlug,
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
      reorderCategories,
      reorderItems,
      setExternalVideo,
      state,
      updateAppearance,
      updateCategoryMutation,
      updateItemMutation,
      updateProfile,
      venues,
      venuesStatus,
      workspace?.venue._id,
    ],
  );

  return (
    <MenuStoreContext.Provider value={store}>
      {children}
    </MenuStoreContext.Provider>
  );
}
