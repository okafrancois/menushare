import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const venueStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

export const externalVideoProvider = v.union(
  v.literal("youtube"),
  v.literal("vimeo"),
);

export default defineSchema({
  venues: defineTable({
    ownerId: v.string(),
    name: v.string(),
    slug: v.string(),
    kind: v.string(),
    city: v.optional(v.string()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    hours: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    coverImageStorageId: v.optional(v.id("_storage")),
    accentColor: v.optional(v.string()),
    status: venueStatus,
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"])
    .index("by_owner_status", ["ownerId", "status"]),

  slugHistory: defineTable({
    venueId: v.id("venues"),
    slug: v.string(),
    active: v.boolean(),
    redirectedTo: v.optional(v.string()),
    releasedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_venue", ["venueId"]),

  menus: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    locale: v.string(),
    currency: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    version: v.number(),
    publishedSnapshotId: v.optional(v.id("menuSnapshots")),
    publishedAt: v.optional(v.number()),
  }).index("by_venue", ["venueId"]),

  categories: defineTable({
    menuId: v.id("menus"),
    name: v.string(),
    eyebrow: v.optional(v.string()),
    order: v.number(),
    active: v.boolean(),
  }).index("by_menu_order", ["menuId", "order"]),

  menuItems: defineTable({
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    order: v.number(),
    active: v.boolean(),
    allergens: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
  }).index("by_category_order", ["categoryId", "order"]),

  media: defineTable({
    venueId: v.id("venues"),
    itemId: v.optional(v.id("menuItems")),
    kind: v.union(v.literal("image"), v.literal("externalVideo")),
    imageStorageId: v.optional(v.id("_storage")),
    provider: v.optional(externalVideoProvider),
    externalId: v.optional(v.string()),
    embedUrl: v.optional(v.string()),
    alt: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_venue", ["venueId"])
    .index("by_item_order", ["itemId", "order"]),

  menuSnapshots: defineTable({
    menuId: v.id("menus"),
    venueId: v.id("venues"),
    version: v.number(),
    publishedBy: v.string(),
    publishedAt: v.number(),
    data: v.any(),
  })
    .index("by_menu_version", ["menuId", "version"])
    .index("by_venue", ["venueId"]),
});

