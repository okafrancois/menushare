// Shared convex-test fixtures. The double extension keeps this file out of
// the Convex bundle and of the generated API.
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";

import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

export const NOW = Date.UTC(2026, 9, 7, 12, 0);

/** The module map built by `import.meta.glob` in each test file. */
type Modules = Record<string, () => Promise<unknown>>;
export type TestConvex = ReturnType<typeof convexTest>;

export function newConvexTest(modules: Modules) {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}

export async function createUser(t: TestConvex, email: string) {
  const user = (await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name: email,
        email,
        emailVerified: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  })) as { _id: string };
  const session = (await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        token: `token-${email}`,
        userId: user._id,
        expiresAt: NOW + 86_400_000 * 365,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  })) as { _id: string };
  return {
    id: user._id,
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}

export type TestUser = Awaited<ReturnType<typeof createUser>>;

/** A venue created and published through the public mutations. */
export async function createPublishedVenue(
  owner: TestUser,
  name: string,
  dishes: string[] = ["Burrata", "Tartare"],
) {
  const { venueId, menuId, slug } = await owner.client.mutation(
    api.venues.create,
    { name, kind: "Bistrot" },
  );
  const categoryId = await owner.client.mutation(api.menus.addCategory, {
    menuId,
    name: "Plats",
  });
  const itemIds: Id<"menuItems">[] = [];
  for (const dish of dishes) {
    itemIds.push(
      await owner.client.mutation(api.menus.addItem, {
        categoryId,
        name: dish,
        priceCents: 1400,
      }),
    );
  }
  await owner.client.mutation(api.menus.publish, { menuId });
  return { venueId, menuId, slug, categoryId, itemIds };
}
