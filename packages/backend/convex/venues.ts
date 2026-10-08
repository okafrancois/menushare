import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { currentUserOrThrow, ownedVenueOrThrow } from "./lib/auth";
import { MAX_TABLES } from "./lib/analytics";
import { normalizeOpeningHours } from "./lib/menu";
import {
  assertFreshUpload,
  deleteFileIfPresent,
  storageIdsIn,
} from "./lib/storage";
import { internal } from "./_generated/api";
import { normalizeExternalVideoUrl } from "./lib/video";
import { openingHours as openingHoursValidator } from "./schema";
import { internalMutation, mutation, query } from "./server";

const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "legal",
  "menu",
  "privacy",
  "sign-in",
  "sign-up",
  "terms",
  "onboarding",
  "preview",
  "help",
  "support",
]);

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function assertSlug(slug: string) {
  if (slug.length < 3 || RESERVED_SLUGS.has(slug)) {
    throw new Error("SLUG_UNAVAILABLE");
  }
}

async function touchVenueMenu(ctx: MutationCtx, venueId: Id<"venues">) {
  const menu = await ctx.db
    .query("menus")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .unique();
  if (menu) {
    await ctx.db.patch(menu._id, { status: "draft", updatedAt: Date.now() });
  }
}

function clearedIfEmpty<T>(values: T[]) {
  return values.length > 0 ? values : undefined;
}

// Kept for clients deployed before multi-establishment pagination.
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUserOrThrow(ctx);
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .filter((q) => q.neq(q.field("deleting"), true))
      .order("desc")
      .take(20);
    return await Promise.all(
      venues.map(async (venue) => ({
        venue,
        menuId: (
          await ctx.db
            .query("menus")
            .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
            .unique()
        )?._id,
      })),
    );
  },
});

export const listMinePaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await currentUserOrThrow(ctx);
    const result = await ctx.db
      .query("venues")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .filter((q) => q.neq(q.field("deleting"), true))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (venue) => ({
          venue,
          menuId: (
            await ctx.db
              .query("menus")
              .withIndex("by_venue", (q) => q.eq("venueId", venue._id))
              .unique()
          )?._id,
        })),
      ),
    };
  },
});

export const checkSlug = query({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const slug = slugify(value);
    if (slug.length < 3 || RESERVED_SLUGS.has(slug)) {
      return { slug, available: false };
    }
    const venue = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const history = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return { slug, available: !venue && !history };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    kind: v.string(),
    requestedSlug: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await currentUserOrThrow(ctx);
    const slug = slugify(args.requestedSlug ?? args.name);
    if (!args.name.trim()) throw new Error("INVALID_NAME");
    assertSlug(slug);

    const existing = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const reserved = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing || reserved) throw new Error("SLUG_UNAVAILABLE");

    const venueId = await ctx.db.insert("venues", {
      ownerId: user._id,
      name: args.name.trim(),
      slug,
      kind: args.kind.trim(),
      city: args.city?.trim(),
      status: "draft",
    });
    await ctx.db.insert("slugHistory", { venueId, slug, active: true });

    const menuId = await ctx.db.insert("menus", {
      venueId,
      name: "Menu principal",
      locale: "fr",
      currency: "EUR",
      status: "draft",
      version: 0,
      updatedAt: Date.now(),
    });

    return { venueId, menuId, slug };
  },
});

/** Taking a menu offline keeps its draft, files and publication history. */
export const setStatus = mutation({
  args: {
    venueId: v.id("venues"),
    status: v.union(v.literal("draft"), v.literal("archived")),
  },
  handler: async (ctx, { venueId, status }) => {
    await ownedVenueOrThrow(ctx, venueId);
    await ctx.db.patch(venueId, { status });
  },
});

export const updateProfile = mutation({
  args: {
    venueId: v.id("venues"),
    name: v.optional(v.string()),
    kind: v.optional(v.string()),
    city: v.optional(v.string()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    hours: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    // An empty list clears the opening hours.
    openingHours: v.optional(openingHoursValidator),
  },
  handler: async (ctx, { venueId, openingHours, ...patch }) => {
    await ownedVenueOrThrow(ctx, venueId);
    await ctx.db.patch(venueId, {
      ...patch,
      ...(openingHours === undefined
        ? {}
        : {
            openingHours: clearedIfEmpty(normalizeOpeningHours(openingHours)),
          }),
    });
    await touchVenueMenu(ctx, venueId);
  },
});

export const updateAppearance = mutation({
  args: {
    venueId: v.id("venues"),
    accentColor: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    coverImageStorageId: v.optional(v.id("_storage")),
    coverVideoUrl: v.optional(v.string()),
    removeLogo: v.optional(v.boolean()),
    removeCoverImage: v.optional(v.boolean()),
    removeCoverVideo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { venue } = await ownedVenueOrThrow(ctx, args.venueId);
    // Re-sending the current file is allowed; any other file must be a fresh
    // upload (see assertFreshUpload).
    for (const storageId of [args.logoStorageId, args.coverImageStorageId]) {
      if (
        storageId &&
        storageId !== venue.logoStorageId &&
        storageId !== venue.coverImageStorageId
      ) {
        await assertFreshUpload(ctx, storageId, { requireImage: true });
      }
    }
    const patch: Record<string, unknown> = {};
    if (args.accentColor !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(args.accentColor))
        throw new Error("INVALID_COLOR");
      patch.accentColor = args.accentColor;
    }
    if (args.logoStorageId) patch.logoStorageId = args.logoStorageId;
    if (args.coverImageStorageId)
      patch.coverImageStorageId = args.coverImageStorageId;
    if (args.removeLogo) patch.logoStorageId = undefined;
    if (args.removeCoverImage) patch.coverImageStorageId = undefined;
    if (args.removeCoverVideo) {
      patch.coverVideoProvider = undefined;
      patch.coverVideoExternalId = undefined;
      patch.coverVideoEmbedUrl = undefined;
    } else if (args.coverVideoUrl) {
      const video = normalizeExternalVideoUrl(args.coverVideoUrl);
      patch.coverVideoProvider = video.provider;
      patch.coverVideoExternalId = video.externalId;
      patch.coverVideoEmbedUrl = video.embedUrl;
    }
    const nextLogo =
      "logoStorageId" in patch ? patch.logoStorageId : venue.logoStorageId;
    const nextCover =
      "coverImageStorageId" in patch
        ? patch.coverImageStorageId
        : venue.coverImageStorageId;
    for (const oldFile of new Set([
      venue.logoStorageId,
      venue.coverImageStorageId,
    ])) {
      if (oldFile && oldFile !== nextLogo && oldFile !== nextCover) {
        await ctx.db.insert("pendingFileDeletions", {
          venueId: venue._id,
          storageId: oldFile,
        });
      }
    }
    await ctx.db.patch(args.venueId, patch);
    await touchVenueMenu(ctx, args.venueId);
  },
});

// Tables only change which QR codes are printed, so the menu stays published.
export const setTableCount = mutation({
  args: { venueId: v.id("venues"), tableCount: v.number() },
  handler: async (ctx, { venueId, tableCount }) => {
    await ownedVenueOrThrow(ctx, venueId);
    if (
      !Number.isInteger(tableCount) ||
      tableCount < 0 ||
      tableCount > MAX_TABLES
    ) {
      throw new Error("INVALID_TABLE_COUNT");
    }
    await ctx.db.patch(venueId, { tableCount });
  },
});

export const generateImageUploadUrl = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, { venueId }) => {
    await ownedVenueOrThrow(ctx, venueId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const changeSlug = mutation({
  args: { venueId: v.id("venues"), requestedSlug: v.string() },
  handler: async (ctx, { venueId, requestedSlug }) => {
    const { venue } = await ownedVenueOrThrow(ctx, venueId);
    const nextSlug = slugify(requestedSlug);
    assertSlug(nextSlug);
    if (nextSlug === venue.slug) return nextSlug;

    const existingVenue = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", nextSlug))
      .unique();
    const existingHistory = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q) => q.eq("slug", nextSlug))
      .unique();
    if (existingVenue || existingHistory) throw new Error("SLUG_UNAVAILABLE");

    const oldHistory = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q) => q.eq("slug", venue.slug))
      .unique();
    if (oldHistory) {
      await ctx.db.patch(oldHistory._id, {
        active: false,
        redirectedTo: nextSlug,
        releasedAt: Date.now(),
      });
    }
    await ctx.db.insert("slugHistory", {
      venueId,
      slug: nextSlug,
      active: true,
    });
    await ctx.db.patch(venueId, { slug: nextSlug });
    await touchVenueMenu(ctx, venueId);
    return nextSlug;
  },
});

export const remove = mutation({
  args: { venueId: v.id("venues"), confirmName: v.string() },
  handler: async (ctx, { venueId, confirmName }) => {
    const { venue } = await ownedVenueOrThrow(ctx, venueId);
    if (confirmName !== venue.name) throw new Error("CONFIRM_NAME");
    await ctx.db.patch(venueId, { deleting: true, status: "archived" });
    await ctx.scheduler.runAfter(0, internal.venues.purgeVenue, { venueId });
  },
});

/** Called by the auth deletion hook; public URLs are withdrawn before deleting the identity. */
export const removeAccountData = internalMutation({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) => q.neq(q.field("deleting"), true))
      .take(100);
    for (const venue of venues) {
      await ctx.db.patch(venue._id, { deleting: true, status: "archived" });
      await ctx.scheduler.runAfter(0, internal.venues.purgeVenue, {
        venueId: venue._id,
      });
    }
    if (venues.length === 100)
      await ctx.scheduler.runAfter(0, internal.venues.removeAccountData, {
        ownerId,
      });
  },
});

/** Deletes in small transactions so media-heavy accounts can leave reliably. */
export const purgeVenue = internalMutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, { venueId }) => {
    const venue = await ctx.db.get(venueId);
    if (!venue?.deleting) return;
    const again = () =>
      ctx.scheduler.runAfter(0, internal.venues.purgeVenue, { venueId });
    const media = await ctx.db
      .query("media")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId))
      .take(100);
    if (media.length) {
      for (const asset of media) {
        if (asset.imageStorageId)
          await deleteFileIfPresent(ctx, asset.imageStorageId);
        await ctx.db.delete(asset._id);
      }
      await again();
      return;
    }
    const menu = await ctx.db
      .query("menus")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId))
      .first();
    if (menu) {
      const category = await ctx.db
        .query("categories")
        .withIndex("by_menu_order", (q) => q.eq("menuId", menu._id))
        .first();
      if (category) {
        const items = await ctx.db
          .query("menuItems")
          .withIndex("by_category_order", (q) =>
            q.eq("categoryId", category._id),
          )
          .take(100);
        for (const item of items) await ctx.db.delete(item._id);
        if (!items.length) await ctx.db.delete(category._id);
      } else await ctx.db.delete(menu._id);
      await again();
      return;
    }
    const snapshot = await ctx.db
      .query("menuSnapshots")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId))
      .first();
    if (snapshot) {
      for (const id of storageIdsIn(snapshot.data))
        await deleteFileIfPresent(ctx, id as Id<"_storage">);
      await ctx.db.delete(snapshot._id);
      await again();
      return;
    }
    for (const table of [
      "slugHistory",
      "soldOutItems",
      "dailySpecials",
      "pendingFileDeletions",
      "analyticsSessions",
    ] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_venue", (q) => q.eq("venueId", venueId))
        .take(100);
      for (const row of rows) {
        if ("imageStorageId" in row && row.imageStorageId)
          await deleteFileIfPresent(ctx, row.imageStorageId);
        if ("storageId" in row) await deleteFileIfPresent(ctx, row.storageId);
        await ctx.db.delete(row._id);
      }
      if (rows.length) {
        await again();
        return;
      }
    }
    const visitors = await ctx.db
      .query("analyticsVisitors")
      .withIndex("by_venue_and_visitor", (q) => q.eq("venueId", venueId))
      .take(100);
    for (const row of visitors) await ctx.db.delete(row._id);
    const daily = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_venue_and_scope_and_day", (q) => q.eq("venueId", venueId))
      .take(100);
    for (const row of daily) await ctx.db.delete(row._id);
    if (visitors.length || daily.length) {
      await again();
      return;
    }
    if (venue.logoStorageId)
      await deleteFileIfPresent(ctx, venue.logoStorageId);
    if (venue.coverImageStorageId)
      await deleteFileIfPresent(ctx, venue.coverImageStorageId);
    await ctx.db.delete(venueId);
  },
});
