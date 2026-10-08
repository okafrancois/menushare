/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SPECIAL_MAX_DURATION_MS } from "./lib/menu";
import {
  createPublishedVenue,
  createUser,
  newConvexTest,
  NOW,
} from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const HOUR = 60 * 60 * 1000;

async function setup() {
  const t = newConvexTest(modules);
  const owner = await createUser(t, "owner@example.com");
  const stranger = await createUser(t, "stranger@example.com");
  const venue = await createPublishedVenue(owner, "Chez Test");
  return { t, owner, stranger, ...venue };
}

type Setup = Awaited<ReturnType<typeof setup>>;

const publicMenu = ({ t, slug }: Setup) =>
  t.query(api.menus.getPublishedBySlug, { slug });

const serviceState = ({ owner, venueId }: Setup) =>
  owner.client.query(api.service.getServiceState, { venueId });

const storeFile = (t: Setup["t"]) =>
  t.run((ctx) => ctx.storage.store(new Blob(["fake image"])));

const fileExists = (t: Setup["t"], storageId: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null);

const specials = (t: Setup["t"]) =>
  t.run((ctx) => ctx.db.query("dailySpecials").take(10));

const jobState = (t: Setup["t"], jobId: Id<"_scheduled_functions">) =>
  t.run(async (ctx) => (await ctx.db.system.get(jobId))?.state.kind);

/**
 * convex-test stores files without a content type, so an accepted image is
 * attached to the special directly, as setDailySpecial would have done.
 */
async function attachImage(t: Setup["t"], specialId: Id<"dailySpecials">) {
  const storageId = await storeFile(t);
  await t.run((ctx) => ctx.db.patch(specialId, { imageStorageId: storageId }));
  return storageId;
}

function special(
  ctx: Setup,
  input: Partial<{
    name: string;
    description: string;
    priceCents: number;
    imageStorageId: Id<"_storage">;
    endsAt: number;
  }> = {},
) {
  return ctx.owner.client.mutation(api.service.setDailySpecial, {
    venueId: ctx.venueId,
    name: "Blanquette de veau",
    priceCents: 1850,
    endsAt: NOW + 10 * HOUR,
    ...input,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sold-out dishes", () => {
  it("marks a dish sold out once, live, without touching the draft", async () => {
    const ctx = await setup();
    const [itemId] = ctx.itemIds as [Id<"menuItems">];
    const menuBefore = await ctx.t.run((db) => db.db.get(ctx.menuId));

    vi.setSystemTime(NOW + 60_000);
    for (let i = 0; i < 2; i++) {
      await ctx.owner.client.mutation(api.service.setSoldOut, {
        itemId,
        soldOut: true,
      });
    }
    const rows = await ctx.t.run((db) => db.db.query("soldOutItems").take(10));
    expect(rows).toMatchObject([
      { itemId, venueId: ctx.venueId, since: NOW + 60_000, autoRestock: true },
    ]);
    expect(await ctx.t.run((db) => db.db.get(ctx.menuId))).toMatchObject({
      status: "published",
      updatedAt: menuBefore!.updatedAt,
      version: 1,
    });
    expect((await publicMenu(ctx)).soldOutItemIds).toEqual([itemId]);
    expect((await serviceState(ctx)).soldOutItemIds).toEqual([itemId]);

    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId,
      soldOut: false,
    });
    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId,
      soldOut: false,
    });
    expect((await publicMenu(ctx)).soldOutItemIds).toEqual([]);
  });

  it("refuses dishes and venues of another owner", async () => {
    const ctx = await setup();
    await expect(
      ctx.stranger.client.mutation(api.service.setSoldOut, {
        itemId: ctx.itemIds[0]!,
        soldOut: true,
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      ctx.stranger.client.query(api.service.getServiceState, {
        venueId: ctx.venueId,
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      ctx.stranger.client.mutation(api.service.setAutoRestock, {
        venueId: ctx.venueId,
        enabled: false,
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      ctx.t.mutation(api.service.setSoldOut, {
        itemId: ctx.itemIds[0]!,
        soldOut: true,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("restocks every night only where automatic restocking is on", async () => {
    const ctx = await setup();
    const other = await createPublishedVenue(ctx.owner, "Le Second", ["Soupe"]);
    const [kept, restocked] = [other.itemIds[0]!, ctx.itemIds[0]!];
    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId: kept,
      soldOut: true,
    });
    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId: restocked,
      soldOut: true,
    });
    // Existing rows follow the venue setting, and so do new ones.
    await ctx.owner.client.mutation(api.service.setAutoRestock, {
      venueId: other.venueId,
      enabled: false,
    });
    expect(
      await ctx.owner.client.query(api.service.getServiceState, {
        venueId: other.venueId,
      }),
    ).toEqual({ soldOutItemIds: [kept], autoRestock: false, special: null });
    expect((await serviceState(ctx)).autoRestock).toBe(true);

    await ctx.t.mutation(internal.service.restockAll, {});
    const rows = await ctx.t.run((db) => db.db.query("soldOutItems").take(10));
    expect(rows).toMatchObject([{ itemId: kept, autoRestock: false }]);

    await ctx.owner.client.mutation(api.service.setAutoRestock, {
      venueId: other.venueId,
      enabled: true,
    });
    await ctx.t.mutation(internal.service.restockAll, {});
    expect(
      await ctx.t.run((db) => db.db.query("soldOutItems").take(10)),
    ).toEqual([]);
  });

  it("restocks in batches", async () => {
    const ctx = await setup();
    await ctx.t.run(async (db) => {
      for (let i = 0; i < 501; i++) {
        await db.db.insert("soldOutItems", {
          venueId: ctx.venueId,
          itemId: ctx.itemIds[i % 2]!,
          since: NOW,
          autoRestock: true,
        });
      }
    });
    await ctx.t.mutation(internal.service.restockAll, {});
    expect(
      await ctx.t.run((db) => db.db.query("soldOutItems").take(10)),
    ).toHaveLength(1);
    await ctx.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await ctx.t.run((db) => db.db.query("soldOutItems").take(10)),
    ).toEqual([]);
  });
});

describe("daily special", () => {
  it("publishes a validated special live", async () => {
    const ctx = await setup();
    const specialId = await special(ctx, {
      name: "  Blanquette de veau  ",
      description: "  À l'ancienne ",
      priceCents: 1849.6,
    });
    const expected = {
      id: specialId,
      name: "Blanquette de veau",
      description: "À l'ancienne",
      priceCents: 1850,
      imageUrl: null,
      endsAt: NOW + 10 * HOUR,
    };
    expect((await publicMenu(ctx)).special).toEqual(expected);
    expect((await serviceState(ctx)).special).toEqual({
      ...expected,
      imageStorageId: null,
    });
    expect(await ctx.t.run((db) => db.db.get(ctx.menuId))).toMatchObject({
      status: "published",
    });
  });

  it("validates the name, price and end", async () => {
    const ctx = await setup();
    await expect(special(ctx, { name: "   " })).rejects.toThrow(
      "INVALID_SPECIAL",
    );
    await expect(special(ctx, { name: "x".repeat(81) })).rejects.toThrow(
      "INVALID_SPECIAL",
    );
    await expect(special(ctx, { priceCents: -1 })).rejects.toThrow(
      "INVALID_SPECIAL",
    );
    await expect(special(ctx, { priceCents: Number.NaN })).rejects.toThrow(
      "INVALID_SPECIAL",
    );
    await expect(special(ctx, { endsAt: NOW })).rejects.toThrow(
      "INVALID_SPECIAL_END",
    );
    await expect(
      special(ctx, { endsAt: NOW + SPECIAL_MAX_DURATION_MS + 1 }),
    ).rejects.toThrow("INVALID_SPECIAL_END");
    await expect(
      ctx.stranger.client.mutation(api.service.setDailySpecial, {
        venueId: ctx.venueId,
        name: "Intrus",
        priceCents: 100,
        endsAt: NOW + HOUR,
      }),
    ).rejects.toThrow("Forbidden");
    expect(await specials(ctx.t)).toEqual([]);

    await special(ctx, {
      name: "x".repeat(80),
      priceCents: 0,
      endsAt: NOW + SPECIAL_MAX_DURATION_MS,
    });
    expect(await specials(ctx.t)).toHaveLength(1);
  });

  it("rejects files that are not images", async () => {
    const ctx = await setup();
    const storageId = await storeFile(ctx.t);
    await expect(special(ctx, { imageStorageId: storageId })).rejects.toThrow(
      "INVALID_IMAGE",
    );
    expect(await specials(ctx.t)).toEqual([]);
  });

  it("replaces the previous special, its image and its expiry", async () => {
    const ctx = await setup();
    const firstId = await special(ctx, { name: "Pot-au-feu" });
    const firstImage = await attachImage(ctx.t, firstId);
    const firstJob = (await specials(ctx.t))[0]!.expiryJobId!;

    // Editing the text keeps the current photo.
    const secondId = await special(ctx, {
      name: "Pot-au-feu maison",
      imageStorageId: firstImage,
    });
    expect(await jobState(ctx.t, firstJob)).toBe("canceled");
    expect(await fileExists(ctx.t, firstImage)).toBe(true);
    const state = await serviceState(ctx);
    expect(state.special).toMatchObject({
      id: secondId,
      name: "Pot-au-feu maison",
      imageStorageId: firstImage,
    });
    expect(state.special?.imageUrl).toEqual(expect.any(String));

    // A new special without photo removes the old one.
    const thirdId = await special(ctx, {
      name: "Choucroute",
      endsAt: NOW + 2 * HOUR,
    });
    expect(await fileExists(ctx.t, firstImage)).toBe(false);
    expect(await specials(ctx.t)).toMatchObject([
      { _id: thirdId, name: "Choucroute" },
    ]);
    expect((await publicMenu(ctx)).special).toMatchObject({
      id: thirdId,
      imageUrl: null,
    });

    // Only the current special's job is still pending.
    vi.advanceTimersByTime(HOUR);
    await ctx.t.finishInProgressScheduledFunctions();
    expect(await specials(ctx.t)).toHaveLength(1);
  });

  it("expires at its end through the scheduler", async () => {
    const ctx = await setup();
    const specialId = await special(ctx, { endsAt: NOW + 3 * HOUR });
    const image = await attachImage(ctx.t, specialId);

    vi.advanceTimersByTime(3 * HOUR - 1);
    await ctx.t.finishInProgressScheduledFunctions();
    expect((await publicMenu(ctx)).special).toMatchObject({ id: specialId });

    await ctx.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await publicMenu(ctx)).special).toBeNull();
    expect(await specials(ctx.t)).toEqual([]);
    expect(await fileExists(ctx.t, image)).toBe(false);
  });

  it("expires idempotently", async () => {
    const ctx = await setup();
    const specialId = await special(ctx);
    const image = await attachImage(ctx.t, specialId);
    await ctx.t.mutation(internal.service.expireSpecial, { specialId });
    await ctx.t.mutation(internal.service.expireSpecial, { specialId });
    expect(await specials(ctx.t)).toEqual([]);
    expect(await fileExists(ctx.t, image)).toBe(false);
  });

  it("can be cleared by its owner only", async () => {
    const ctx = await setup();
    const specialId = await special(ctx);
    const image = await attachImage(ctx.t, specialId);
    const jobId = (await specials(ctx.t))[0]!.expiryJobId!;
    await expect(
      ctx.stranger.client.mutation(api.service.clearDailySpecial, {
        venueId: ctx.venueId,
      }),
    ).rejects.toThrow("Forbidden");

    await ctx.owner.client.mutation(api.service.clearDailySpecial, {
      venueId: ctx.venueId,
    });
    expect(await specials(ctx.t)).toEqual([]);
    expect(await fileExists(ctx.t, image)).toBe(false);
    expect(await jobState(ctx.t, jobId)).toBe("canceled");
    expect((await publicMenu(ctx)).special).toBeNull();
    await ctx.owner.client.mutation(api.service.clearDailySpecial, {
      venueId: ctx.venueId,
    });
  });
});
