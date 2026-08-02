import { v } from "convex/values";

import { currentUserOrThrow, ownedMenuOrThrow } from "./lib/auth";
import { normalizeExternalVideoUrl } from "./lib/video";
import { mutation, query } from "./server";

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
                .withIndex("by_item_order", (q: any) => q.eq("itemId", item._id))
                .collect(),
            })),
          ),
        };
      }),
    );
    return { venue, menu, categories: hydrated };
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
      venue,
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
                media: await ctx.db
                  .query("media")
                  .withIndex("by_item_order", (q: any) => q.eq("itemId", item._id))
                  .collect(),
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

