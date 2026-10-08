// Live service controls (sold-out dishes, daily special). They act on the
// published menu immediately and never send it back to draft.
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ownedMenuOrThrow, ownedVenueOrThrow } from "./lib/auth";
import { SPECIAL_MAX_DURATION_MS, SPECIAL_NAME_MAX } from "./lib/menu";
import { currentSpecial, soldOutItemIds, specialView } from "./lib/service";
import { assertFreshUpload } from "./lib/storage";
import { internalMutation, mutation, query } from "./server";

const RESTOCK_BATCH = 500;

async function deleteFileIfPresent(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  if (await ctx.db.system.get("_storage", storageId)) {
    await ctx.storage.delete(storageId);
  }
}

/** Deletes a special, its pending expiry job and its image unless kept. */
async function deleteSpecial(
  ctx: MutationCtx,
  special: Doc<"dailySpecials">,
  keptImageId?: Id<"_storage">,
) {
  if (special.expiryJobId) {
    const job = await ctx.db.system.get(
      "_scheduled_functions",
      special.expiryJobId,
    );
    if (job?.state.kind === "pending") {
      await ctx.scheduler.cancel(special.expiryJobId);
    }
  }
  if (special.imageStorageId && special.imageStorageId !== keptImageId) {
    await deleteFileIfPresent(ctx, special.imageStorageId);
  }
  await ctx.db.delete("dailySpecials", special._id);
}

export const getServiceState = query({
  args: { venueId: v.id("venues") },
  returns: v.object({
    soldOutItemIds: v.array(v.id("menuItems")),
    autoRestock: v.boolean(),
    special: v.union(
      v.null(),
      v.object({
        id: v.id("dailySpecials"),
        name: v.string(),
        description: v.optional(v.string()),
        priceCents: v.number(),
        imageUrl: v.union(v.string(), v.null()),
        imageStorageId: v.union(v.id("_storage"), v.null()),
        endsAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { venueId }) => {
    const { venue } = await ownedVenueOrThrow(ctx, venueId);
    const special = await currentSpecial(ctx, venueId);
    return {
      soldOutItemIds: await soldOutItemIds(ctx, venueId),
      autoRestock: venue.autoRestock ?? true,
      special: special
        ? {
            ...(await specialView(ctx, special)),
            imageStorageId: special.imageStorageId ?? null,
          }
        : null,
    };
  },
});

export const setSoldOut = mutation({
  args: { itemId: v.id("menuItems"), soldOut: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { itemId, soldOut }) => {
    const item = await ctx.db.get("menuItems", itemId);
    if (!item) throw new Error("NOT_FOUND");
    const category = await ctx.db.get("categories", item.categoryId);
    if (!category) throw new Error("NOT_FOUND");
    const { venue } = await ownedMenuOrThrow(ctx, category.menuId);
    const rows = await ctx.db
      .query("soldOutItems")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .take(10);
    if (soldOut) {
      if (rows.length === 0) {
        await ctx.db.insert("soldOutItems", {
          venueId: venue._id,
          itemId,
          since: Date.now(),
          autoRestock: venue.autoRestock ?? true,
        });
      }
    } else {
      for (const row of rows) await ctx.db.delete("soldOutItems", row._id);
    }
    return null;
  },
});

export const setAutoRestock = mutation({
  args: { venueId: v.id("venues"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { venueId, enabled }) => {
    await ownedVenueOrThrow(ctx, venueId);
    await ctx.db.patch("venues", venueId, { autoRestock: enabled });
    // Bounded by the size of the menu (one row per sold-out dish).
    const rows = ctx.db
      .query("soldOutItems")
      .withIndex("by_venue", (q) => q.eq("venueId", venueId));
    for await (const row of rows) {
      if (row.autoRestock !== enabled) {
        await ctx.db.patch("soldOutItems", row._id, { autoRestock: enabled });
      }
    }
    return null;
  },
});

/** Nightly: puts sold-out dishes back on the menu where restock is automatic. */
export const restockAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("soldOutItems")
      .withIndex("by_auto_restock", (q) => q.eq("autoRestock", true))
      .take(RESTOCK_BATCH);
    for (const row of rows) await ctx.db.delete("soldOutItems", row._id);
    if (rows.length === RESTOCK_BATCH) {
      await ctx.scheduler.runAfter(0, internal.service.restockAll, {});
    }
    return null;
  },
});

export const setDailySpecial = mutation({
  args: {
    venueId: v.id("venues"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
    endsAt: v.number(),
  },
  returns: v.id("dailySpecials"),
  handler: async (ctx, args) => {
    await ownedVenueOrThrow(ctx, args.venueId);
    const name = args.name.trim();
    if (
      !name ||
      name.length > SPECIAL_NAME_MAX ||
      !Number.isFinite(args.priceCents) ||
      args.priceCents < 0
    ) {
      throw new Error("INVALID_SPECIAL");
    }
    const now = Date.now();
    if (!(args.endsAt > now && args.endsAt <= now + SPECIAL_MAX_DURATION_MS)) {
      throw new Error("INVALID_SPECIAL_END");
    }

    const existing = await currentSpecial(ctx, args.venueId);
    // The image of the special being edited was checked when attached.
    const keepsImage =
      args.imageStorageId !== undefined &&
      args.imageStorageId === existing?.imageStorageId;
    if (args.imageStorageId && !keepsImage) {
      await assertFreshUpload(ctx, args.imageStorageId, { requireImage: true });
    }

    if (existing) await deleteSpecial(ctx, existing, args.imageStorageId);
    const specialId = await ctx.db.insert("dailySpecials", {
      venueId: args.venueId,
      name,
      description: args.description?.trim() || undefined,
      priceCents: Math.max(0, Math.round(args.priceCents)),
      imageStorageId: args.imageStorageId,
      endsAt: args.endsAt,
      createdAt: now,
    });
    const expiryJobId = await ctx.scheduler.runAt(
      args.endsAt,
      internal.service.expireSpecial,
      { specialId },
    );
    await ctx.db.patch("dailySpecials", specialId, { expiryJobId });
    return specialId;
  },
});

export const clearDailySpecial = mutation({
  args: { venueId: v.id("venues") },
  returns: v.null(),
  handler: async (ctx, { venueId }) => {
    await ownedVenueOrThrow(ctx, venueId);
    const special = await currentSpecial(ctx, venueId);
    if (special) await deleteSpecial(ctx, special);
    return null;
  },
});

export const expireSpecial = internalMutation({
  args: { specialId: v.id("dailySpecials") },
  returns: v.null(),
  handler: async (ctx, { specialId }) => {
    const special = await ctx.db.get("dailySpecials", specialId);
    if (special) await deleteSpecial(ctx, special);
    return null;
  },
});
