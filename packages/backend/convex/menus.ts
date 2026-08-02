import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { currentUserOrThrow, ownedMenuOrThrow } from "./lib/auth";
import { normalizeExternalVideoUrl } from "./lib/video";
import { mutation, query } from "./server";

async function mediaWithUrl(ctx: QueryCtx | MutationCtx, media: Doc<"media">) {
  return {
    ...media,
    imageUrl: media.imageStorageId
      ? await ctx.storage.getUrl(media.imageStorageId)
      : undefined,
  };
}

async function touchMenu(ctx: MutationCtx, menuId: Id<"menus">) {
  await ctx.db.patch(menuId, { status: "draft", updatedAt: Date.now() });
}

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
    await ownedMenuOrThrow(ctx, category.menuId);
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
        if (asset.imageStorageId)
          await ctx.storage.delete(asset.imageStorageId);
        await ctx.db.delete(asset._id);
      }
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
    priceCents: v.number(),
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
    const itemId = await ctx.db.insert("menuItems", {
      categoryId: args.categoryId,
      name: args.name.trim(),
      description: args.description?.trim(),
      priceCents: Math.max(0, Math.round(args.priceCents)),
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
    priceCents: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { itemId, ...patch }) => {
    const { menuId } = await menuIdForItem(ctx, itemId);
    await ctx.db.patch(itemId, {
      ...patch,
      name: patch.name?.trim(),
      description: patch.description?.trim(),
      priceCents:
        patch.priceCents === undefined
          ? undefined
          : Math.max(0, Math.round(patch.priceCents)),
    });
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
    await ownedMenuOrThrow(ctx, category.menuId);
    const media = await ctx.db
      .query("media")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .take(20);
    for (const asset of media) {
      if (asset.imageStorageId) await ctx.storage.delete(asset.imageStorageId);
      await ctx.db.delete(asset._id);
    }
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
    const metadata = await ctx.db.system.get(storageId);
    if (
      !metadata ||
      !metadata.contentType?.startsWith("image/") ||
      metadata.size > 2 * 1024 * 1024
    ) {
      await ctx.storage.delete(storageId);
      throw new Error("INVALID_IMAGE");
    }
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
    await ownedMenuOrThrow(ctx, category.menuId);
    if (media.imageStorageId) await ctx.storage.delete(media.imageStorageId);
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
    await ctx.db.patch(menuId, {
      status: "published",
      version,
      updatedAt: publishedAt,
      publishedAt,
      publishedSnapshotId: snapshotId,
    });
    await ctx.db.patch(venue._id, { status: "published" });
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
      const redirectSlug = history.redirectedTo;
      redirectedFrom = slug;
      venue = await ctx.db
        .query("venues")
        .withIndex("by_slug", (q) => q.eq("slug", redirectSlug))
        .unique();
    }

    if (!venue || venue.status !== "published") return null;
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
      .take(10);
    const menu = menus.find((candidate) => candidate.publishedSnapshotId);
    if (!menu?.publishedSnapshotId) return null;
    const snapshot = await ctx.db.get(menu.publishedSnapshotId);
    return snapshot ? { ...snapshot.data, redirectedFrom } : null;
  },
});
