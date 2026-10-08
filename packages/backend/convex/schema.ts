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

export const analyticsScope = v.union(
  v.literal("venue"),
  v.literal("item"),
  v.literal("cover"),
  v.literal("table"),
);

export const analyticsSource = v.union(
  v.literal("qr"),
  v.literal("table"),
  v.literal("direct"),
);

// Weekly opening hours, see normalizeOpeningHours in lib/menu.ts.
export const openingHours = v.array(
  v.object({
    day: v.number(),
    ranges: v.array(v.object({ open: v.string(), close: v.string() })),
  }),
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
    coverVideoProvider: v.optional(externalVideoProvider),
    coverVideoExternalId: v.optional(v.string()),
    coverVideoEmbedUrl: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    tableCount: v.optional(v.number()),
    openingHours: v.optional(openingHours),
    // Sold-out dishes come back automatically every night unless disabled.
    // Absent means true.
    autoRestock: v.optional(v.boolean()),
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
    updatedAt: v.number(),
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
    details: v.optional(v.string()),
    priceCents: v.number(),
    order: v.number(),
    active: v.boolean(),
    // Absent: not provided by the owner; []: no major allergen.
    allergens: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    ingredients: v.optional(v.array(v.string())),
    pairingName: v.optional(v.string()),
    pairingPriceCents: v.optional(v.number()),
    reviewRating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    reviewQuote: v.optional(v.string()),
    reviewAuthor: v.optional(v.string()),
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

  // Live service state, outside drafts and published snapshots: changing it
  // never sends the menu back to draft.
  soldOutItems: defineTable({
    venueId: v.id("venues"),
    itemId: v.id("menuItems"),
    since: v.number(),
    // Copied from the venue so the nightly restock can use a single index.
    autoRestock: v.boolean(),
  })
    .index("by_venue", ["venueId"])
    .index("by_item", ["itemId"])
    .index("by_auto_restock", ["autoRestock"]),

  // At most one daily special per venue, removed by a scheduled job at endsAt.
  dailySpecials: defineTable({
    venueId: v.id("venues"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
    endsAt: v.number(),
    createdAt: v.number(),
    expiryJobId: v.optional(v.id("_scheduled_functions")),
  }).index("by_venue", ["venueId"]),

  // Files removed from the draft while the published menu may still show
  // them; deleted at the next publication.
  pendingFileDeletions: defineTable({
    venueId: v.id("venues"),
    storageId: v.id("_storage"),
  }).index("by_venue", ["venueId"]),

  // Daily counters, one row per venue/day and per dimension (dish, cover
  // video, table). Every KPI shown to owners is summed from these rows.
  analyticsDaily: defineTable({
    venueId: v.id("venues"),
    day: v.string(),
    scope: analyticsScope,
    key: v.string(),
    sessions: v.number(),
    scans: v.number(),
    visitors: v.number(),
    // Visitors whose most recent visit falls on this day: summing it over a
    // window that ends today counts each visitor exactly once.
    lastSeenVisitors: v.number(),
    durationMs: v.number(),
    itemOpens: v.number(),
    videoPlays: v.number(),
    videoCompletions: v.number(),
  })
    .index("by_venue_and_scope_and_day", ["venueId", "scope", "day"])
    .index("by_venue_and_scope_and_key_and_day", [
      "venueId",
      "scope",
      "key",
      "day",
    ]),

  analyticsVisitors: defineTable({
    venueId: v.id("venues"),
    visitorId: v.string(),
    lastSeenDay: v.string(),
  })
    .index("by_venue_and_visitor", ["venueId", "visitorId"])
    .index("by_last_seen_day", ["lastSeenDay"]),

  analyticsSessions: defineTable({
    venueId: v.id("venues"),
    sessionId: v.string(),
    day: v.string(),
    startedAt: v.number(),
    activeMs: v.number(),
    source: analyticsSource,
    table: v.optional(v.number()),
    events: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_started_at", ["startedAt"]),
});
