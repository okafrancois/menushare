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
  storeFile,
  storeImage,
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

const liveService = ({ t, venueId }: Setup) =>
  t.query(api.menus.getLiveService, { venueId });

const serviceState = ({ owner, venueId }: Setup) =>
  owner.client.query(api.service.getServiceState, { venueId });

const fileExists = (t: Setup["t"], storageId: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null);

const specials = (t: Setup["t"]) =>
  t.run((ctx) => ctx.db.query("dailySpecials").take(10));

const jobState = (t: Setup["t"], jobId: Id<"_scheduled_functions">) =>
  t.run(async (ctx) => (await ctx.db.system.get(jobId))?.state.kind);

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
    expect((await liveService(ctx)).soldOutItemIds).toEqual([itemId]);
    expect((await serviceState(ctx)).soldOutItemIds).toEqual([itemId]);

    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId,
      soldOut: false,
    });
    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId,
      soldOut: false,
    });
    expect((await liveService(ctx)).soldOutItemIds).toEqual([]);
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
    expect((await liveService(ctx)).special).toEqual(expected);
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

  it("edits the current special in place", async () => {
    const ctx = await setup();
    const firstImage = await storeImage(ctx.t);
    const specialId = await special(ctx, {
      name: "Pot-au-feu",
      imageStorageId: firstImage,
    });
    const firstJob = (await specials(ctx.t))[0]!.expiryJobId!;

    // Editing the text keeps the current photo.
    expect(
      await special(ctx, {
        name: "Pot-au-feu maison",
        imageStorageId: firstImage,
      }),
    ).toBe(specialId);
    expect(await jobState(ctx.t, firstJob)).toBe("canceled");
    expect(await fileExists(ctx.t, firstImage)).toBe(true);
    const state = await serviceState(ctx);
    expect(state.special).toMatchObject({
      id: specialId,
      name: "Pot-au-feu maison",
      imageStorageId: firstImage,
    });
    expect(state.special?.imageUrl).toEqual(expect.any(String));

    // A new photo replaces the old one.
    const secondImage = await storeImage(ctx.t);
    await special(ctx, { name: "Choucroute", imageStorageId: secondImage });
    expect(await fileExists(ctx.t, firstImage)).toBe(false);

    // Removing the photo deletes it; the description is cleared too.
    await special(ctx, { name: "Choucroute", endsAt: NOW + 2 * HOUR });
    expect(await fileExists(ctx.t, secondImage)).toBe(false);
    expect(await specials(ctx.t)).toMatchObject([
      { _id: specialId, name: "Choucroute", endsAt: NOW + 2 * HOUR },
    ]);
    expect((await specials(ctx.t))[0]).not.toHaveProperty("imageStorageId");
    expect((await liveService(ctx)).special).toMatchObject({
      id: specialId,
      imageUrl: null,
      endsAt: NOW + 2 * HOUR,
    });

    // Only the latest expiry job is still pending.
    const jobs = await ctx.t.run((db) =>
      db.db.system.query("_scheduled_functions").take(10),
    );
    expect(jobs.filter((job) => job.state.kind === "pending")).toHaveLength(1);
    vi.advanceTimersByTime(HOUR);
    await ctx.t.finishInProgressScheduledFunctions();
    expect(await specials(ctx.t)).toHaveLength(1);
    await ctx.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await specials(ctx.t)).toEqual([]);
  });

  it("expires at its end through the scheduler", async () => {
    const ctx = await setup();
    const image = await storeImage(ctx.t);
    const specialId = await special(ctx, {
      endsAt: NOW + 3 * HOUR,
      imageStorageId: image,
    });

    vi.advanceTimersByTime(3 * HOUR - 1);
    await ctx.t.finishInProgressScheduledFunctions();
    expect((await liveService(ctx)).special).toMatchObject({ id: specialId });

    await ctx.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await liveService(ctx)).special).toBeNull();
    expect(await specials(ctx.t)).toEqual([]);
    expect(await fileExists(ctx.t, image)).toBe(false);
  });

  it("expires idempotently", async () => {
    const ctx = await setup();
    const image = await storeImage(ctx.t);
    const specialId = await special(ctx, { imageStorageId: image });
    await ctx.t.mutation(internal.service.expireSpecial, { specialId });
    await ctx.t.mutation(internal.service.expireSpecial, { specialId });
    expect(await specials(ctx.t)).toEqual([]);
    expect(await fileExists(ctx.t, image)).toBe(false);
  });

  it("can be cleared by its owner only", async () => {
    const ctx = await setup();
    const image = await storeImage(ctx.t);
    const specialId = await special(ctx, { imageStorageId: image });
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
    expect((await liveService(ctx)).special).toBeNull();
    await ctx.owner.client.mutation(api.service.clearDailySpecial, {
      venueId: ctx.venueId,
    });
  });
});

describe("live service", () => {
  it("is empty for unknown or unpublished venues", async () => {
    const ctx = await setup();
    await ctx.owner.client.mutation(api.service.setSoldOut, {
      itemId: ctx.itemIds[0]!,
      soldOut: true,
    });
    await special(ctx);
    expect((await liveService(ctx)).soldOutItemIds).toHaveLength(1);

    const empty = { soldOutItemIds: [], special: null };
    expect(
      await ctx.t.query(api.menus.getLiveService, { venueId: "not-an-id" }),
    ).toEqual(empty);
    await ctx.t.run((db) => db.db.patch(ctx.venueId, { status: "draft" }));
    expect(await liveService(ctx)).toEqual(empty);
  });
});
