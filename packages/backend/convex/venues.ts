import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { currentUserOrThrow, ownedVenueOrThrow } from "./lib/auth";
import { normalizeExternalVideoUrl } from "./lib/video";
import { mutation, query } from "./server";

const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "legal",
  "menu",
  "privacy",
  "sign-in",
  "sign-up",
  "terms",
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

// Kept for clients deployed before multi-establishment pagination.
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUserOrThrow(ctx);
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
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
  },
  handler: async (ctx, { venueId, ...patch }) => {
    await ownedVenueOrThrow(ctx, venueId);
    await ctx.db.patch(venueId, patch);
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
    await ownedVenueOrThrow(ctx, args.venueId);
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
    await ctx.db.patch(args.venueId, patch);
    await touchVenueMenu(ctx, args.venueId);
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
