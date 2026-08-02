import { v } from "convex/values";

import { currentUserOrThrow, ownedVenueOrThrow } from "./lib/auth";
import { mutation, query } from "./server";

const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "legal",
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

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUserOrThrow(ctx);
    return await ctx.db
      .query("venues")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
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
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();
    const history = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
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
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();
    const reserved = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
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
      .withIndex("by_slug", (q: any) => q.eq("slug", nextSlug))
      .unique();
    const existingHistory = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q: any) => q.eq("slug", nextSlug))
      .unique();
    if (existingVenue || existingHistory) throw new Error("SLUG_UNAVAILABLE");

    const oldHistory = await ctx.db
      .query("slugHistory")
      .withIndex("by_slug", (q: any) => q.eq("slug", venue.slug))
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
    return nextSlug;
  },
});

