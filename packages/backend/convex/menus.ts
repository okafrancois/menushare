import { v } from "convex/values";

import { currentUserOrThrow, ownedMenuOrThrow } from "./lib/auth";
import { normalizeExternalVideoUrl } from "./lib/video";
import { mutation, query } from "./server";

async function mediaWithUrl(ctx: any, media: any) {
  return {
    ...media,
    imageUrl: media.imageStorageId
      ? await ctx.storage.getUrl(media.imageStorageId)
      : undefined,
  };
}

export const getDraft = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const { menu, venue } = await ownedMenuOrThrow(ctx, menuId);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q: any) => q.eq("menuId", menuId))
      .collect();
    const hydrated = await Promise.all(
      categories.map(async (category: any) => {
        const items = await ctx.db
          .query("menuItems")
          .withIndex("by_category_order", (q: any) =>
            q.eq("categoryId", category._id),
          )
          .collect();
        return {
          ...category,
          items: await Promise.all(
            items.map(async (item: any) => ({
              ...item,
              media: await ctx.db
                .query("media")
                .withIndex("by_item_order", (q: any) =>
                  q.eq("itemId", item._id),
                )
                .collect(),
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
        hydrated.map(async (category: any) => ({
          ...category,
          items: await Promise.all(
            category.items.map(async (item: any) => ({
              ...item,
              media: await Promise.all(
                item.media.map((asset: any) => mediaWithUrl(ctx, asset)),
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
      .withIndex("by_menu_order", (q: any) => q.eq("menuId", args.menuId))
      .collect();
    return await ctx.db.insert("categories", {
      menuId: args.menuId,
      name: args.name.trim(),
      eyebrow: args.eyebrow?.trim(),
      order: categories.length,
      active: true,
    });
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
  },
});

export const reorderCategories = mutation({
  args: { menuId: v.id("menus"), categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, { menuId, categoryIds }) => {
    await ownedMenuOrThrow(ctx, menuId);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q: any) => q.eq("menuId", menuId))
      .collect();
    if (
      categories.length !== categoryIds.length ||
      categories.some((category: any) => !categoryIds.includes(category._id))
    )
      throw new Error("INVALID_ORDER");
    await Promise.all(
      categoryIds.map((id, order) => ctx.db.patch(id, { order })),
    );
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
      .withIndex("by_category_order", (q: any) =>
        q.eq("categoryId", categoryId),
      )
      .collect();
    for (const item of items) {
      const media = await ctx.db
        .query("media")
        .withIndex("by_item_order", (q: any) => q.eq("itemId", item._id))
        .collect();
      for (const asset of media) {
        if (asset.imageStorageId)
          await ctx.storage.delete(asset.imageStorageId);
        await ctx.db.delete(asset._id);
      }
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(categoryId);
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
      .withIndex("by_category_order", (q: any) =>
        q.eq("categoryId", args.categoryId),
      )
      .collect();
    return await ctx.db.insert("menuItems", {
      categoryId: args.categoryId,
      name: args.name.trim(),
      description: args.description?.trim(),
      priceCents: Math.max(0, Math.round(args.priceCents)),
      order: items.length,
      active: true,
    });
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
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("NOT_FOUND");
    const category = await ctx.db.get(item.categoryId);
    if (!category) throw new Error("NOT_FOUND");
    await ownedMenuOrThrow(ctx, category.menuId);
    await ctx.db.patch(itemId, {
      ...patch,
      name: patch.name?.trim(),
      description: patch.description?.trim(),
      priceCents:
        patch.priceCents === undefined
          ? undefined
          : Math.max(0, Math.round(patch.priceCents)),
    });
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
      .withIndex("by_category_order", (q: any) =>
        q.eq("categoryId", categoryId),
      )
      .collect();
    if (
      items.length !== itemIds.length ||
      items.some((item: any) => !itemIds.includes(item._id))
    )
      throw new Error("INVALID_ORDER");
    await Promise.all(itemIds.map((id, order) => ctx.db.patch(id, { order })));
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
      .withIndex("by_item_order", (q: any) => q.eq("itemId", itemId))
      .collect();
    for (const asset of media) {
      if (asset.imageStorageId) await ctx.storage.delete(asset.imageStorageId);
      await ctx.db.delete(asset._id);
    }
    await ctx.db.delete(itemId);
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
      .withIndex("by_item_order", (q: any) => q.eq("itemId", itemId))
      .collect();
    const existingVideo = existing.find(
      (media: any) => media.kind === "externalVideo",
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
      return existingVideo._id;
    }
    return await ctx.db.insert("media", data);
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
      .withIndex("by_item_order", (q: any) => q.eq("itemId", itemId))
      .collect();
    await Promise.all(
      media
        .filter((asset: any) => asset.kind === "externalVideo")
        .map((asset: any) => ctx.db.delete(asset._id)),
    );
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
      .withIndex("by_item_order", (q: any) => q.eq("itemId", itemId))
      .collect();
    if (media.filter((asset: any) => asset.kind === "image").length >= 8) {
      await ctx.storage.delete(storageId);
      throw new Error("IMAGE_LIMIT_REACHED");
    }
    return await ctx.db.insert("media", {
      venueId: venue._id,
      itemId,
      kind: "image",
      imageStorageId: storageId,
      alt: alt?.trim(),
      order: media.length,
    });
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
  },
});

export const publish = mutation({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const user = await currentUserOrThrow(ctx);
    const { menu, venue } = await ownedMenuOrThrow(ctx, menuId);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_menu_order", (q: any) => q.eq("menuId", menuId))
      .collect();
    const data = {
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
        categories.map(async (category: any) => {
          const items = await ctx.db
            .query("menuItems")
            .withIndex("by_category_order", (q: any) =>
              q.eq("categoryId", category._id),
            )
            .collect();
          return {
            ...category,
            items: await Promise.all(
              items.map(async (item: any) => ({
                ...item,
                media: await Promise.all(
                  (
                    await ctx.db
                      .query("media")
                      .withIndex("by_item_order", (q: any) =>
                        q.eq("itemId", item._id),
                      )
                      .collect()
                  ).map((asset: any) => mediaWithUrl(ctx, asset)),
                ),
              })),
            ),
          };
        }),
      ),
    };

    const version = menu.version + 1;
    const publishedAt = Date.now();
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
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();
    let redirectedFrom: string | undefined;

    if (!venue) {
      const history = await ctx.db
        .query("slugHistory")
        .withIndex("by_slug", (q: any) => q.eq("slug", slug))
        .unique();
      if (!history?.redirectedTo) return null;
      redirectedFrom = slug;
      venue = await ctx.db
        .query("venues")
        .withIndex("by_slug", (q: any) => q.eq("slug", history.redirectedTo))
        .unique();
    }

    if (!venue || venue.status !== "published") return null;
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_venue", (q: any) => q.eq("venueId", venue._id))
      .collect();
    const menu = menus.find((candidate: any) => candidate.publishedSnapshotId);
    if (!menu?.publishedSnapshotId) return null;
    const snapshot = await ctx.db.get(menu.publishedSnapshotId);
    return snapshot ? { ...snapshot.data, redirectedFrom } : null;
  },
});
