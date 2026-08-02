import { authComponent } from "../betterAuth/auth";

export async function currentUserOrThrow(ctx: any) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function ownedVenueOrThrow(ctx: any, venueId: any) {
  const user = await currentUserOrThrow(ctx);
  const venue = await ctx.db.get(venueId);
  if (!venue || venue.ownerId !== user._id) throw new Error("Forbidden");
  return { user, venue };
}

export async function ownedMenuOrThrow(ctx: any, menuId: any) {
  const menu = await ctx.db.get(menuId);
  if (!menu) throw new Error("Forbidden");
  const { user, venue } = await ownedVenueOrThrow(ctx, menu.venueId);
  return { user, venue, menu };
}

