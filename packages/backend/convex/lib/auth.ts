import { authComponent } from "../betterAuth/auth";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseCtx = QueryCtx | MutationCtx;

export async function currentUserOrThrow(ctx: DatabaseCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function ownedVenueOrThrow(
  ctx: DatabaseCtx,
  venueId: Id<"venues">,
) {
  const user = await currentUserOrThrow(ctx);
  const venue = await ctx.db.get(venueId);
  if (!venue || venue.ownerId !== user._id) throw new Error("Forbidden");
  return { user, venue };
}

export async function ownedMenuOrThrow(ctx: DatabaseCtx, menuId: Id<"menus">) {
  const menu = await ctx.db.get(menuId);
  if (!menu) throw new Error("Forbidden");
  const { user, venue } = await ownedVenueOrThrow(ctx, menu.venueId);
  return { user, venue, menu };
}
