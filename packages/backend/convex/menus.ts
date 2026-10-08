import type { WithoutSystemFields } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { currentUserOrThrow, ownedMenuOrThrow } from "./lib/auth";
import { normalizeAllergens, normalizeTags } from "./lib/menu";
import {
  clearSoldOut,
  currentSpecial,
  soldOutItemIds,
  specialView,
} from "./lib/service";
import {
  assertFreshUpload,
  deleteFileIfPresent,
  storageIdsIn,
  withoutPrivateFields,
} from "./lib/storage";
import { normalizeExternalVideoUrl } from "./lib/video";
import { internalMutation, mutation, query } from "./server";

async function mediaWithUrl(ctx: QueryCtx | MutationCtx, media: Doc<"media">) {
  return {
    ...media,
    imageUrl: media.imageStorageId
      ? await ctx.storage.getUrl(media.imageStorageId)
      : undefined,
  };
}

function cents(value: number) {
  return Math.max(0, Math.round(value));
}

async function touchMenu(ctx: MutationCtx, menuId: Id<"menus">) {
  await ctx.db.patch(menuId, { status: "draft", updatedAt: Date.now() });
}

/**
 * Deletes a file removed from the draft. The published menu may still show
 * it, so it then waits for the next publication (see purgePendingFileBatch).
 */
async function releaseFile(
  ctx: MutationCtx,
  menu: Doc<"menus">,
  storageId: Id<"_storage">,
) {
  const references = await ctx.db
    .query("media")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .take(2);
  if (references.length > 1) return;
  if (menu.publishedSnapshotId) {
    await ctx.db.insert("pendingFileDeletions", {
      venueId: menu.venueId,
      storageId,
    });
  } else {
    await deleteFileIfPresent(ctx, storageId);
  }
}

const FILE_PURGE_BATCH = 500;

/**
 * Deletes files queued up to `before` (the publication time), except those
 * the published menu still references, then continues in a new transaction
 * if the batch was full.
 */
async function purgePendingFileBatch(
  ctx: MutationCtx,
  venueId: Id<"venues">,
  published: Set<string>,
  before: number,
  cursor: string | null = null,
) {
  // The last ten publications remain restorable, including their photos.
  const current = new Set(published);
  const revisions = await ctx.db
    .query("menuSnapshots")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .order("desc")
    .take(10);
  for (const revision of revisions) storageIdsIn(revision.data, published);
  const page = await ctx.db
    .query("pendingFileDeletions")
    .withIndex("by_venue", (q) =>
      q.eq("venueId", venueId).lte("_creationTime", before),
    )
    .paginate({ cursor, numItems: FILE_PURGE_BATCH });
  for (const row of page.page) {
    if (current.has(row.storageId)) {
      await ctx.db.delete("pendingFileDeletions", row._id);
      continue;
    }
    if (!published.has(row.storageId)) {
      await deleteFileIfPresent(ctx, row.storageId);
      await ctx.db.delete("pendingFileDeletions", row._id);
    }
  }
  if (!page.isDone) {
    await ctx.scheduler.runAfter(0, internal.menus.purgePendingFiles, {
      venueId,
      before,
      cursor: page.continueCursor,
    });
  }
}

export const purgePendingFiles = internalMutation({
  args: {
    venueId: v.id("venues"),
    before: v.number(),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { venueId, before, cursor }) => {
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId))
      .take(10);
    const published = new Set<string>();
    for (const menu of menus) {
      const snapshot = menu.publishedSnapshotId
        ? await ctx.db.get("menuSnapshots", menu.publishedSnapshotId)
        : null;
      if (snapshot) storageIdsIn(snapshot.data, published);
    }
    await purgePendingFileBatch(ctx, venueId, published, before, cursor);
    return null;
  },
});

async function menuIdForItem(ctx: MutationCtx, itemId: Id<"menuItems">) {
  const item = await ctx.db.get(itemId);
  if (!item) throw new Error("NOT_FOUND");
  const category = await ctx.db.get(item.categoryId);
  if (!category) throw new Error("NOT_FOUND");
  await ownedMenuOrThrow(ctx, category.menuId);
  return { item, category, menuId: category.menuId };
}

export const getDraft = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const { menu, venue } = await ownedMenuOrThrow(ctx, menuId);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q) => q.eq("menuId", menuId))
      .take(100);
    const hydrated = await Promise.all(
      categories.map(async (category) => {
        const items = await ctx.db
          .query("menuItems")
          .withIndex("by_category_order", (q) =>
            q.eq("categoryId", category._id),
          )
          .take(200);
        return {
          ...category,
          items: await Promise.all(
            items.map(async (item) => ({
              ...item,
              media: await ctx.db
                .query("media")
                .withIndex("by_item_order", (q) => q.eq("itemId", item._id))
                .take(20),
            })),
          ),
        };
      }),
    );
    return {
      venue: {
        ...venue,
        logoUrl: venue.logoStorageId
          ? await ctx.storage.getUrl(venue.logoStorageId)
          : undefined,
        coverImageUrl: venue.coverImageStorageId
          ? await ctx.storage.getUrl(venue.coverImageStorageId)
          : undefined,
      },
      menu,
      categories: await Promise.all(
        hydrated.map(async (category) => ({
          ...category,
          items: await Promise.all(
            category.items.map(async (item) => ({
              ...item,
              media: await Promise.all(
                item.media.map((asset) => mediaWithUrl(ctx, asset)),
              ),
            })),
          ),
        })),
      ),
    };
  },
});

export const addCategory = mutation({
  args: {
    menuId: v.id("menus"),
    name: v.string(),
    eyebrow: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ownedMenuOrThrow(ctx, args.menuId);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q) => q.eq("menuId", args.menuId))
      .take(100);
    if (categories.length >= 100) throw new Error("CATEGORY_LIMIT_REACHED");
    const categoryId = await ctx.db.insert("categories", {
      menuId: args.menuId,
      name: args.name.trim(),
      eyebrow: args.eyebrow?.trim(),
      order: categories.length,
      active: true,
    });
    await touchMenu(ctx, args.menuId);
    return categoryId;
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    eyebrow: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { categoryId, ...patch }) => {
    const category = await ctx.db.get(categoryId);
    if (!category) throw new Error("NOT_FOUND");
    await ownedMenuOrThrow(ctx, category.menuId);
    await ctx.db.patch(categoryId, {
      ...patch,
      name: patch.name?.trim(),
      eyebrow: patch.eyebrow?.trim(),
    });
    await touchMenu(ctx, category.menuId);
  },
});

export const reorderCategories = mutation({
  args: { menuId: v.id("menus"), categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, { menuId, categoryIds }) => {
    await ownedMenuOrThrow(ctx, menuId);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q) => q.eq("menuId", menuId))
      .take(100);
    if (
      categories.length !== categoryIds.length ||
      categories.some((category) => !categoryIds.includes(category._id))
    )
      throw new Error("INVALID_ORDER");
    await Promise.all(
      categoryIds.map((id, order) => ctx.db.patch(id, { order })),
    );
    await touchMenu(ctx, menuId);
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const category = await ctx.db.get(categoryId);
    if (!category) return;
    const { menu } = await ownedMenuOrThrow(ctx, category.menuId);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category_order", (q) => q.eq("categoryId", categoryId))
      .take(200);
    for (const item of items) {
      const media = await ctx.db
        .query("media")
        .withIndex("by_item_order", (q) => q.eq("itemId", item._id))
        .take(20);
      for (const asset of media) {
        if (asset.imageStorageId) {
          await releaseFile(ctx, menu, asset.imageStorageId);
        }
        await ctx.db.delete(asset._id);
      }
      await clearSoldOut(ctx, item._id);
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(categoryId);
    await touchMenu(ctx, category.menuId);
  },
});

export const addItem = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    details: v.optional(v.string()),
    priceCents: v.number(),
    allergens: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    ingredients: v.optional(v.array(v.string())),
    pairingName: v.optional(v.string()),
    pairingPriceCents: v.optional(v.number()),
    reviewRating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    reviewQuote: v.optional(v.string()),
    reviewAuthor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Forbidden");
    await ownedMenuOrThrow(ctx, category.menuId);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category_order", (q) =>
        q.eq("categoryId", args.categoryId),
      )
      .take(200);
    if (items.length >= 200) throw new Error("ITEM_LIMIT_REACHED");
    const itemId = await ctx.db.insert("menuItems", {
      categoryId: args.categoryId,
      name: args.name.trim(),
      description: args.description?.trim(),
      details: args.details?.trim(),
      priceCents: cents(args.priceCents),
      allergens:
        args.allergens === undefined
          ? undefined
          : normalizeAllergens(args.allergens),
      tags: args.tags === undefined ? undefined : normalizeTags(args.tags),
      ingredients: args.ingredients
        ?.map((value) => value.trim())
        .filter(Boolean),
      pairingName: args.pairingName?.trim(),
      pairingPriceCents:
        args.pairingPriceCents === undefined
          ? undefined
          : cents(args.pairingPriceCents),
      reviewRating: args.reviewRating,
      reviewCount: args.reviewCount,
      reviewQuote: args.reviewQuote?.trim(),
      reviewAuthor: args.reviewAuthor?.trim(),
      order: items.length,
      active: true,
    });
    await touchMenu(ctx, category.menuId);
    return itemId;
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("menuItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    details: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    active: v.optional(v.boolean()),
    // null: allergens not provided (distinct from [], no major allergen).
    allergens: v.optional(v.union(v.array(v.string()), v.null())),
    tags: v.optional(v.array(v.string())),
    ingredients: v.optional(v.array(v.string())),
    pairingName: v.optional(v.string()),
    pairingPriceCents: v.optional(v.union(v.number(), v.null())),
    reviewRating: v.optional(v.union(v.number(), v.null())),
    reviewCount: v.optional(v.union(v.number(), v.null())),
    reviewQuote: v.optional(v.string()),
    reviewAuthor: v.optional(v.string()),
  },
  // Omitted arguments leave their field unchanged; an empty optional text or
  // a null value removes the field.
  handler: async (ctx, { itemId, ...args }) => {
    const { menuId } = await menuIdForItem(ctx, itemId);
    const patch: Partial<WithoutSystemFields<Doc<"menuItems">>> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("INVALID_NAME");
      patch.name = name;
    }
    for (const key of [
      "description",
      "details",
      "pairingName",
      "reviewQuote",
      "reviewAuthor",
    ] as const) {
      const value = args[key];
      if (value !== undefined) patch[key] = value.trim() || undefined;
    }
    if (args.priceCents !== undefined)
      patch.priceCents = cents(args.priceCents);
    if (args.active !== undefined) patch.active = args.active;
    if (args.pairingPriceCents !== undefined) {
      patch.pairingPriceCents =
        args.pairingPriceCents === null
          ? undefined
          : cents(args.pairingPriceCents);
    }
    if (args.reviewRating !== undefined) {
      patch.reviewRating = args.reviewRating ?? undefined;
    }
    if (args.reviewCount !== undefined) {
      patch.reviewCount = args.reviewCount ?? undefined;
    }
    if (args.allergens !== undefined) {
      patch.allergens =
        args.allergens === null
          ? undefined
          : normalizeAllergens(args.allergens);
    }
    if (args.tags !== undefined) patch.tags = normalizeTags(args.tags);
    if (args.ingredients !== undefined) {
      patch.ingredients = args.ingredients
        .map((value) => value.trim())
        .filter(Boolean);
    }
    await ctx.db.patch(itemId, patch);
    await touchMenu(ctx, menuId);
  },
});

export const reorderItems = mutation({
  args: { categoryId: v.id("categories"), itemIds: v.array(v.id("menuItems")) },
  handler: async (ctx, { categoryId, itemIds }) => {
    const category = await ctx.db.get(categoryId);
    if (!category) throw new Error("NOT_FOUND");
    await ownedMenuOrThrow(ctx, category.menuId);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category_order", (q) => q.eq("categoryId", categoryId))
      .take(200);
    if (
      items.length !== itemIds.length ||
      items.some((item) => !itemIds.includes(item._id))
    )
      throw new Error("INVALID_ORDER");
    await Promise.all(itemIds.map((id, order) => ctx.db.patch(id, { order })));
    await touchMenu(ctx, category.menuId);
  },
});

export const deleteItem = mutation({
  args: { itemId: v.id("menuItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return;
    const category = await ctx.db.get(item.categoryId);
    if (!category) throw new Error("NOT_FOUND");
    const { menu } = await ownedMenuOrThrow(ctx, category.menuId);
    const media = await ctx.db
      .query("media")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .take(20);
    for (const asset of media) {
      if (asset.imageStorageId) {
        await releaseFile(ctx, menu, asset.imageStorageId);
      }
      await ctx.db.delete(asset._id);
    }
    await clearSoldOut(ctx, itemId);
    await ctx.db.delete(itemId);
    await touchMenu(ctx, category.menuId);
  },
});

export const setExternalVideo = mutation({
  args: {
    itemId: v.id("menuItems"),
    url: v.string(),
  },
  handler: async (ctx, { itemId, url }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Forbidden");
    const category = await ctx.db.get(item.categoryId);
    if (!category) throw new Error("Forbidden");
    const { venue } = await ownedMenuOrThrow(ctx, category.menuId);
    const normalized = normalizeExternalVideoUrl(url);

    const existing = await ctx.db
      .query("media")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .take(20);
    const existingVideo = existing.find(
      (media) => media.kind === "externalVideo",
    );
    const data = {
      venueId: venue._id,
      itemId,
      kind: "externalVideo" as const,
      provider: normalized.provider,
      externalId: normalized.externalId,
      embedUrl: normalized.embedUrl,
      order: existingVideo?.order ?? existing.length,
    };
    if (existingVideo) {
      await ctx.db.patch(existingVideo._id, data);
      await touchMenu(ctx, category.menuId);
      return existingVideo._id;
    }
    const mediaId = await ctx.db.insert("media", data);
    await touchMenu(ctx, category.menuId);
    return mediaId;
  },
});

export const removeExternalVideo = mutation({
  args: { itemId: v.id("menuItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("NOT_FOUND");
    const category = await ctx.db.get(item.categoryId);
    if (!category) throw new Error("NOT_FOUND");
    await ownedMenuOrThrow(ctx, category.menuId);
    const media = await ctx.db
      .query("media")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .take(20);
    await Promise.all(
      media
        .filter((asset) => asset.kind === "externalVideo")
        .map((asset) => ctx.db.delete(asset._id)),
    );
    await touchMenu(ctx, category.menuId);
  },
});

export const addItemImage = mutation({
  args: {
    itemId: v.id("menuItems"),
    storageId: v.id("_storage"),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, storageId, alt }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("NOT_FOUND");
    const category = await ctx.db.get(item.categoryId);
    if (!category) throw new Error("NOT_FOUND");
    const { venue } = await ownedMenuOrThrow(ctx, category.menuId);
    await assertFreshUpload(ctx, storageId, { requireImage: true });
    const media = await ctx.db
      .query("media")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .take(20);
    if (media.filter((asset) => asset.kind === "image").length >= 8) {
      await ctx.storage.delete(storageId);
      throw new Error("IMAGE_LIMIT_REACHED");
    }
    const mediaId = await ctx.db.insert("media", {
      venueId: venue._id,
      itemId,
      kind: "image",
      imageStorageId: storageId,
      alt: alt?.trim(),
      order: media.length,
    });
    await touchMenu(ctx, category.menuId);
    return mediaId;
  },
});

export const removeMedia = mutation({
  args: { mediaId: v.id("media") },
  handler: async (ctx, { mediaId }) => {
    const media = await ctx.db.get(mediaId);
    if (!media?.itemId) throw new Error("NOT_FOUND");
    const item = await ctx.db.get(media.itemId);
    if (!item) throw new Error("NOT_FOUND");
    const category = await ctx.db.get(item.categoryId);
    if (!category) throw new Error("NOT_FOUND");
    const { menu } = await ownedMenuOrThrow(ctx, category.menuId);
    if (media.imageStorageId) {
      await releaseFile(ctx, menu, media.imageStorageId);
    }
    await ctx.db.delete(mediaId);
    await touchMenu(ctx, category.menuId);
  },
});

export const publish = mutation({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const user = await currentUserOrThrow(ctx);
    const { menu, venue } = await ownedMenuOrThrow(ctx, menuId);
    const version = menu.version + 1;
    const publishedAt = Date.now();
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q) => q.eq("menuId", menuId))
      .take(100);
    const data = {
      venue: {
        ...venue,
        status: "published" as const,
        logoUrl: venue.logoStorageId
          ? await ctx.storage.getUrl(venue.logoStorageId)
          : undefined,
        coverImageUrl: venue.coverImageStorageId
          ? await ctx.storage.getUrl(venue.coverImageStorageId)
          : undefined,
      },
      menu: {
        ...menu,
        status: "published" as const,
        version,
        updatedAt: publishedAt,
        publishedAt,
      },
      categories: await Promise.all(
        categories.map(async (category) => {
          const items = await ctx.db
            .query("menuItems")
            .withIndex("by_category_order", (q) =>
              q.eq("categoryId", category._id),
            )
            .take(200);
          return {
            ...category,
            items: await Promise.all(
              items.map(async (item) => ({
                ...item,
                media: await Promise.all(
                  (
                    await ctx.db
                      .query("media")
                      .withIndex("by_item_order", (q) =>
                        q.eq("itemId", item._id),
                      )
                      .take(20)
                  ).map((asset) => mediaWithUrl(ctx, asset)),
                ),
              })),
            ),
          };
        }),
      ),
    };

    const snapshotId = await ctx.db.insert("menuSnapshots", {
      menuId,
      venueId: venue._id,
      version,
      publishedBy: user._id,
      publishedAt,
      data,
    });
    const revisions = await ctx.db
      .query("menuSnapshots")
      .withIndex("by_menu_version", (q) => q.eq("menuId", menuId))
      .order("desc")
      .take(11);
    for (const old of revisions.slice(10)) await ctx.db.delete(old._id);
    await ctx.db.patch(menuId, {
      status: "published",
      version,
      updatedAt: publishedAt,
      publishedAt,
      publishedSnapshotId: snapshotId,
    });
    await ctx.db.patch(venue._id, { status: "published" });
    // Files removed since the previous publication are no longer shown.
    // Files queued after this snapshot are left to the next publication.
    const snapshot = await ctx.db.get("menuSnapshots", snapshotId);
    await purgePendingFileBatch(
      ctx,
      venue._id,
      storageIdsIn(data),
      snapshot!._creationTime,
    );
    return { snapshotId, version, publishedAt };
  },
});

export const getPublishedBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    let venue = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    let redirectedFrom: string | undefined;

    if (!venue) {
      const history = await ctx.db
        .query("slugHistory")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!history?.redirectedTo) return null;
      redirectedFrom = slug;
      venue = await ctx.db.get("venues", history.venueId);
    }

    if (!venue || venue.status !== "published") return null;
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
      .take(10);
    const menu = menus.find((candidate) => candidate.publishedSnapshotId);
    if (!menu?.publishedSnapshotId) return null;
    const snapshot = await ctx.db.get(menu.publishedSnapshotId);
    if (!snapshot) return null;
    // Storage identifiers and the owner id stay private. Live service state
    // is served by getLiveService so that it does not resend the whole menu.
    const published = withoutPrivateFields(snapshot.data);
    return {
      ...published,
      venue: { ...published.venue, slug: venue.slug },
      redirectedFrom,
    };
  },
});

const NO_LIVE_SERVICE = { soldOutItemIds: [], special: null };

/**
 * Public: sold-out dishes and daily special of a published venue, read live
 * (outside the snapshot). Expired specials are removed by a scheduled job, so
 * no clock is read here.
 */
export const getLiveService = query({
  args: { venueId: v.string() },
  returns: v.object({
    soldOutItemIds: v.array(v.string()),
    special: v.union(
      v.null(),
      v.object({
        id: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        priceCents: v.number(),
        imageUrl: v.union(v.string(), v.null()),
        endsAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const venueId = ctx.db.normalizeId("venues", args.venueId);
    const venue = venueId ? await ctx.db.get("venues", venueId) : null;
    if (!venueId || !venue || venue.status !== "published") {
      return NO_LIVE_SERVICE;
    }
    const special = await currentSpecial(ctx, venueId);
    return {
      soldOutItemIds: await soldOutItemIds(ctx, venueId),
      special: special ? await specialView(ctx, special) : null,
    };
  },
});

/** The menu as currently published, to compare it with the draft. */
export const getPublishedSnapshot = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const { menu } = await ownedMenuOrThrow(ctx, menuId);
    if (!menu.publishedSnapshotId) return null;
    const snapshot = await ctx.db.get(menu.publishedSnapshotId);
    return snapshot ? snapshot.data : null;
  },
});

export const listVersions = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    await ownedMenuOrThrow(ctx, menuId);
    const snapshots = await ctx.db
      .query("menuSnapshots")
      .withIndex("by_menu_version", (q) => q.eq("menuId", menuId))
      .order("desc")
      .take(10);
    return snapshots.map((snapshot) => snapshot.data);
  },
});

type SnapshotData = {
  venue: Doc<"venues">;
  categories: (Doc<"categories"> & {
    items: (Doc<"menuItems"> & {
      media: (Doc<"media"> & { imageUrl?: string | null })[];
    })[];
  })[];
};

export const restoreVersion = mutation({
  args: { menuId: v.id("menus"), version: v.number() },
  handler: async (ctx, { menuId, version }) => {
    const { menu, venue } = await ownedMenuOrThrow(ctx, menuId);
    const revision = await ctx.db
      .query("menuSnapshots")
      .withIndex("by_menu_version", (q) =>
        q.eq("menuId", menuId).eq("version", version),
      )
      .unique();
    if (!revision) throw new Error("VERSION_NOT_FOUND");
    const data = revision.data as SnapshotData;
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q) => q.eq("menuId", menuId))
      .take(100);
    for (const category of categories) {
      const items = await ctx.db
        .query("menuItems")
        .withIndex("by_category_order", (q) => q.eq("categoryId", category._id))
        .take(200);
      for (const item of items) {
        const media = await ctx.db
          .query("media")
          .withIndex("by_item_order", (q) => q.eq("itemId", item._id))
          .take(20);
        for (const asset of media) {
          if (asset.imageStorageId)
            await releaseFile(ctx, menu, asset.imageStorageId);
          await ctx.db.delete(asset._id);
        }
        await clearSoldOut(ctx, item._id);
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(category._id);
    }
    for (const category of data.categories) {
      const categoryId = await ctx.db.insert("categories", {
        menuId,
        name: category.name,
        eyebrow: category.eyebrow,
        order: category.order,
        active: category.active,
      });
      for (const raw of category.items) {
        const { _id, _creationTime, media, ...fields } = raw;
        const itemId = await ctx.db.insert("menuItems", {
          ...fields,
          categoryId,
        });
        for (const asset of media) {
          const {
            _id: assetId,
            _creationTime: created,
            imageUrl,
            ...assetFields
          } = asset;
          if (
            asset.imageStorageId &&
            !(await ctx.db.system.get("_storage", asset.imageStorageId))
          )
            continue;
          await ctx.db.insert("media", {
            ...assetFields,
            itemId,
            venueId: venue._id,
          });
        }
      }
    }
    const profile = data.venue;
    for (const oldFile of new Set([
      venue.logoStorageId,
      venue.coverImageStorageId,
    ])) {
      if (
        oldFile &&
        oldFile !== profile.logoStorageId &&
        oldFile !== profile.coverImageStorageId
      ) {
        await ctx.db.insert("pendingFileDeletions", {
          venueId: venue._id,
          storageId: oldFile,
        });
      }
    }
    await ctx.db.patch(venue._id, {
      name: profile.name,
      kind: profile.kind,
      city: profile.city,
      tagline: profile.tagline,
      description: profile.description,
      phone: profile.phone,
      address: profile.address,
      hours: profile.hours,
      openingHours: profile.openingHours,
      accentColor: profile.accentColor,
      logoStorageId: profile.logoStorageId,
      coverImageStorageId: profile.coverImageStorageId,
      coverVideoProvider: profile.coverVideoProvider,
      coverVideoExternalId: profile.coverVideoExternalId,
      coverVideoEmbedUrl: profile.coverVideoEmbedUrl,
    });
    await touchMenu(ctx, menuId);
  },
});

export const duplicateItem = mutation({
  args: { itemId: v.id("menuItems") },
  handler: async (ctx, { itemId }) => {
    const { item, category, menuId } = await menuIdForItem(ctx, itemId);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category_order", (q) => q.eq("categoryId", category._id))
      .take(200);
    if (items.length >= 200) throw new Error("ITEM_LIMIT_REACHED");
    const { _id, _creationTime, ...fields } = item;
    const id = await ctx.db.insert("menuItems", {
      ...fields,
      name: `${item.name} (copie)`,
      order: Math.max(-1, ...items.map((i) => i.order)) + 1,
    });
    const media = await ctx.db
      .query("media")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .take(20);
    for (const asset of media) {
      const { _id: assetId, _creationTime: created, ...assetFields } = asset;
      await ctx.db.insert("media", { ...assetFields, itemId: id });
    }
    await touchMenu(ctx, menuId);
    return id;
  },
});

export const moveItem = mutation({
  args: { itemId: v.id("menuItems"), categoryId: v.id("categories") },
  handler: async (ctx, { itemId, categoryId }) => {
    const { item, menuId } = await menuIdForItem(ctx, itemId);
    const target = await ctx.db.get(categoryId);
    if (!target || target.menuId !== menuId) throw new Error("Forbidden");
    if (item.categoryId === categoryId) return;
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category_order", (q) => q.eq("categoryId", categoryId))
      .take(200);
    if (items.length >= 200) throw new Error("ITEM_LIMIT_REACHED");
    await ctx.db.patch(itemId, {
      categoryId,
      order: Math.max(-1, ...items.map((i) => i.order)) + 1,
    });
    await touchMenu(ctx, menuId);
  },
});

export const importItems = mutation({
  args: {
    menuId: v.id("menus"),
    rows: v.array(
      v.object({
        category: v.string(),
        name: v.string(),
        priceCents: v.number(),
        description: v.string(),
      }),
    ),
  },
  handler: async (ctx, { menuId, rows }) => {
    await ownedMenuOrThrow(ctx, menuId);
    if (!rows.length || rows.length > 500) throw new Error("INVALID_IMPORT");
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q) => q.eq("menuId", menuId))
      .take(100);
    const targets = new Map<
      string,
      { id: Id<"categories">; count: number; nextOrder: number }
    >();
    for (const category of categories) {
      const items = await ctx.db
        .query("menuItems")
        .withIndex("by_category_order", (q) => q.eq("categoryId", category._id))
        .take(200);
      targets.set(category.name.toLocaleLowerCase("fr-FR"), {
        id: category._id,
        count: items.length,
        nextOrder: Math.max(-1, ...items.map((i) => i.order)) + 1,
      });
    }
    let nextOrder = Math.max(-1, ...categories.map((c) => c.order)) + 1;
    let categoryCount = categories.length;
    for (const row of rows) {
      if (
        !row.category.trim() ||
        row.category.length > 100 ||
        !row.name.trim() ||
        row.name.length > 120 ||
        row.description.length > 1000 ||
        !Number.isSafeInteger(row.priceCents) ||
        row.priceCents < 0
      )
        throw new Error("INVALID_IMPORT");
      const key = row.category.trim().toLocaleLowerCase("fr-FR");
      let target = targets.get(key);
      if (!target) {
        if (categoryCount >= 100) throw new Error("CATEGORY_LIMIT_REACHED");
        target = {
          id: await ctx.db.insert("categories", {
            menuId,
            name: row.category.trim(),
            order: nextOrder++,
            active: true,
          }),
          count: 0,
          nextOrder: 0,
        };
        targets.set(key, target);
        categoryCount++;
      }
      if (target.count >= 200) throw new Error("ITEM_LIMIT_REACHED");
      await ctx.db.insert("menuItems", {
        categoryId: target.id,
        name: row.name.trim(),
        description: row.description.trim(),
        priceCents: row.priceCents,
        active: true,
        order: target.nextOrder++,
      });
      target.count++;
    }
    await touchMenu(ctx, menuId);
  },
});
