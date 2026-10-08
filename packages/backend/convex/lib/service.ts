import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseCtx = QueryCtx | MutationCtx;

// A menu holds at most 100 categories of 200 dishes; this bounds the live
// sold-out list read by every visitor.
export const SOLD_OUT_LIMIT = 500;

export async function soldOutItemIds(ctx: DatabaseCtx, venueId: Id<"venues">) {
  const rows = await ctx.db
    .query("soldOutItems")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .take(SOLD_OUT_LIMIT);
  return rows.map((row) => row.itemId);
}

export async function currentSpecial(ctx: DatabaseCtx, venueId: Id<"venues">) {
  return await ctx.db
    .query("dailySpecials")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .first();
}

export async function specialView(
  ctx: DatabaseCtx,
  special: Doc<"dailySpecials">,
) {
  return {
    id: special._id,
    name: special.name,
    description: special.description,
    priceCents: special.priceCents,
    imageUrl: special.imageStorageId
      ? await ctx.storage.getUrl(special.imageStorageId)
      : null,
    endsAt: special.endsAt,
  };
}

/** Removes the live sold-out state of a dish that is being deleted. */
export async function clearSoldOut(ctx: MutationCtx, itemId: Id<"menuItems">) {
  const rows = await ctx.db
    .query("soldOutItems")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .take(10);
  for (const row of rows) await ctx.db.delete("soldOutItems", row._id);
}
