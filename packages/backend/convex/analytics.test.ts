/// <reference types="vite/client" />
import type { FunctionArgs } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { dayKey, shiftDay } from "./lib/analytics";
import { createUser, newConvexTest, NOW } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const TODAY = dayKey(NOW);
const DAY_MS = 86_400_000;

async function setup() {
  const t = newConvexTest(modules);
  const owner = await createUser(t, "owner@example.com");
  const stranger = await createUser(t, "stranger@example.com");
  const ids = await t.run(async (ctx) => {
    const venueId = await ctx.db.insert("venues", {
      ownerId: owner.id,
      name: "Chez Test",
      slug: "chez-test",
      kind: "Bistrot",
      status: "published",
      tableCount: 5,
    });
    const menuId = await ctx.db.insert("menus", {
      venueId,
      name: "Menu",
      locale: "fr",
      currency: "EUR",
      status: "published",
      version: 1,
      updatedAt: NOW,
    });
    const categoryId = await ctx.db.insert("categories", {
      menuId,
      name: "Plats",
      order: 0,
      active: true,
    });
    const itemId = await ctx.db.insert("menuItems", {
      categoryId,
      name: "Burrata",
      priceCents: 1400,
      order: 0,
      active: true,
    });
    const otherVenueId = await ctx.db.insert("venues", {
      ownerId: stranger.id,
      name: "Ailleurs",
      slug: "ailleurs",
      kind: "Café",
      status: "published",
    });
    const otherMenuId = await ctx.db.insert("menus", {
      venueId: otherVenueId,
      name: "Menu",
      locale: "fr",
      currency: "EUR",
      status: "published",
      version: 1,
      updatedAt: NOW,
    });
    const otherCategoryId = await ctx.db.insert("categories", {
      menuId: otherMenuId,
      name: "Plats",
      order: 0,
      active: true,
    });
    const foreignItemId = await ctx.db.insert("menuItems", {
      categoryId: otherCategoryId,
      name: "Croissant",
      priceCents: 200,
      order: 0,
      active: true,
    });
    return { venueId, categoryId, itemId, otherVenueId, foreignItemId };
  });
  return { t, owner, stranger, ...ids };
}

type Setup = Awaited<ReturnType<typeof setup>>;

function visit(
  { t, venueId }: Setup,
  options: {
    visitorId?: string;
    source?: "qr" | "table" | "direct";
    table?: number;
  } = {},
) {
  const sessionId = crypto.randomUUID();
  const send = (event: FunctionArgs<typeof api.analytics.track>["event"]) =>
    t.mutation(api.analytics.track, { sessionId, event });
  return {
    sessionId,
    start: () =>
      send({
        type: "start",
        venueId,
        visitorId: options.visitorId ?? crypto.randomUUID(),
        source: options.source ?? "qr",
        table: options.table,
      }),
    send,
  };
}

function stats({ owner, venueId }: Setup, days = 7) {
  return owner.client.query(api.analytics.getStats, {
    venueId: venueId as Id<"venues">,
    today: dayKey(Date.now()),
    days,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("analytics tracking", () => {
  it("counts scans, visits and unique visitors over the period", async () => {
    const ctx = await setup();
    const visitorId = crypto.randomUUID();
    await visit(ctx, { visitorId }).start();
    await visit(ctx, { visitorId, source: "direct" }).start();
    vi.setSystemTime(NOW + 86_400_000);
    await visit(ctx, { visitorId }).start();
    await visit(ctx).start();

    const result = await stats(ctx);
    expect(result.totals).toMatchObject({
      visits: 4,
      scans: 3,
      uniqueVisitors: 2,
    });
    expect(result.daily.at(-2)).toEqual({ day: TODAY, visits: 2, scans: 1 });
    expect(result.daily.at(-1)).toMatchObject({ visits: 2, scans: 2 });
  });

  it("starts each session only once", async () => {
    const ctx = await setup();
    const session = visit(ctx);
    await session.start();
    await session.start();
    expect((await stats(ctx)).totals.visits).toBe(1);
  });

  it("attributes visits, time and dishes to existing tables only", async () => {
    const ctx = await setup();
    const atTable = visit(ctx, { source: "table", table: 3 });
    await atTable.start();
    await atTable.send({ type: "itemOpen", itemId: ctx.itemId });
    vi.setSystemTime(NOW + 40_000);
    await atTable.send({ type: "heartbeat", activeMs: 30_000 });
    await visit(ctx, { source: "table", table: 9 }).start();

    const result = await stats(ctx);
    expect(result.totals.scans).toBe(2);
    expect(result.tables).toHaveLength(5);
    expect(result.tables[2]).toEqual({
      table: 3,
      active: true,
      scans: 1,
      averageDurationMs: 30_000,
      itemOpens: 1,
    });
    expect(result.totals.averageDurationMs).toBe(15_000);
  });

  it("ranks dishes and ignores dishes from another venue", async () => {
    const ctx = await setup();
    const session = visit(ctx);
    await session.start();
    await session.send({ type: "itemOpen", itemId: ctx.itemId });
    await session.send({ type: "itemOpen", itemId: ctx.itemId });
    await session.send({ type: "itemOpen", itemId: ctx.foreignItemId });
    await session.send({ type: "itemOpen", itemId: "not-an-id" });

    const result = await stats(ctx);
    expect(result.totals.itemOpens).toBe(2);
    expect(result.dishes).toEqual([
      {
        itemId: ctx.itemId,
        name: "Burrata",
        opens: 2,
        videoPlays: 0,
        videoCompletions: 0,
      },
    ]);
  });

  it("measures video plays and completion for dishes and the cover", async () => {
    const ctx = await setup();
    const session = visit(ctx);
    await session.start();
    await session.send({ type: "videoPlay", itemId: ctx.itemId });
    await session.send({ type: "videoComplete", itemId: ctx.itemId });
    await session.send({ type: "videoPlay" });
    await session.send({ type: "videoPlay" });
    await session.send({ type: "videoComplete" });

    const result = await stats(ctx);
    expect(result.totals.videoPlays).toBe(3);
    expect(result.totals.completionRate).toBeCloseTo(2 / 3);
    expect(result.coverVideo).toEqual({ plays: 2, completions: 1 });
    expect(result.dishes[0]).toMatchObject({
      videoPlays: 1,
      videoCompletions: 1,
    });
  });

  it("never reports a completion rate above 100 %", async () => {
    const ctx = await setup();
    const session = visit(ctx);
    await session.start();
    await session.send({ type: "videoComplete" });
    await session.send({ type: "videoComplete" });
    await session.send({ type: "videoPlay" });
    expect((await stats(ctx)).totals.completionRate).toBe(1);
  });

  it("ignores events for unknown sessions and the owner's own visits", async () => {
    const ctx = await setup();
    await ctx.t.mutation(api.analytics.track, {
      sessionId: crypto.randomUUID(),
      event: { type: "itemOpen", itemId: ctx.itemId },
    });
    await ctx.owner.client.mutation(api.analytics.track, {
      sessionId: crypto.randomUUID(),
      event: {
        type: "start",
        venueId: ctx.venueId,
        visitorId: crypto.randomUUID(),
        source: "qr",
      },
    });
    expect((await stats(ctx)).totals).toMatchObject({
      visits: 0,
      itemOpens: 0,
    });
  });

  it("does not track unpublished venues", async () => {
    const ctx = await setup();
    await ctx.t.run((db) =>
      db.db.patch(ctx.venueId as Id<"venues">, { status: "draft" }),
    );
    await visit(ctx).start();
    expect((await stats(ctx)).totals.visits).toBe(0);
  });

  it("only shows statistics to the venue owner", async () => {
    const ctx = await setup();
    await expect(
      ctx.stranger.client.query(api.analytics.getStats, {
        venueId: ctx.venueId as Id<"venues">,
        today: TODAY,
        days: 7,
      }),
    ).rejects.toThrow("Forbidden");
    await expect(stats(ctx, 12)).rejects.toThrow("INVALID_PERIOD");
  });

  it("purges visitor identifiers and stale sessions", async () => {
    const ctx = await setup();
    await visit(ctx).start();
    vi.setSystemTime(NOW + 120 * 86_400_000);
    await ctx.t.mutation(internal.analytics.purgeExpired, {});
    const remaining = await ctx.t.run(async (db) => ({
      sessions: await db.db.query("analyticsSessions").take(10),
      visitors: await db.db.query("analyticsVisitors").take(10),
      daily: await db.db.query("analyticsDaily").take(10),
    }));
    expect(remaining.sessions).toHaveLength(0);
    expect(remaining.visitors).toHaveLength(0);
    expect(remaining.daily).toHaveLength(1);
  });
});

describe("period comparison", () => {
  it("reports the previous period of the same length", async () => {
    const ctx = await setup();
    vi.setSystemTime(NOW - 20 * DAY_MS);
    await visit(ctx).start(); // before both periods
    vi.setSystemTime(NOW - 13 * DAY_MS);
    await visit(ctx).start(); // first day of the previous period
    vi.setSystemTime(NOW - 7 * DAY_MS);
    const late = visit(ctx, { source: "direct" });
    await late.start(); // last day of the previous period
    await late.send({ type: "itemOpen", itemId: ctx.itemId });
    vi.setSystemTime(NOW - 6 * DAY_MS);
    await visit(ctx).start(); // first day of the current period
    vi.setSystemTime(NOW);
    await visit(ctx).start();

    const result = await stats(ctx);
    expect(result.totals).toMatchObject({ visits: 2, scans: 2 });
    expect(result.previousTotals).toEqual({
      scans: 1,
      visits: 2,
      uniqueVisitors: 2,
      averageDurationMs: 0,
      itemOpens: 1,
      videoPlays: 0,
      videoCompletions: 0,
      completionRate: null,
    });
  });

  it("summarizes today against the same day last week", async () => {
    const ctx = await setup();
    vi.setSystemTime(NOW - 7 * DAY_MS);
    await visit(ctx).start();
    await visit(ctx, { source: "direct" }).start();
    vi.setSystemTime(NOW - 6 * DAY_MS);
    await visit(ctx).start(); // another day, ignored
    vi.setSystemTime(NOW);
    const session = visit(ctx);
    await session.start();
    await session.send({ type: "itemOpen", itemId: ctx.itemId });
    vi.setSystemTime(NOW + 40_000);
    await session.send({ type: "heartbeat", activeMs: 30_000 });

    const summary = await ctx.owner.client.query(api.analytics.getDaySummary, {
      venueId: ctx.venueId,
      today: TODAY,
    });
    expect(summary).toEqual({
      today: { scans: 1, visits: 1, itemOpens: 1, averageDurationMs: 30_000 },
      sameDayLastWeek: {
        scans: 1,
        visits: 2,
        itemOpens: 0,
        averageDurationMs: 0,
      },
    });
  });

  it("returns empty summaries and protects them", async () => {
    const ctx = await setup();
    expect(
      await ctx.owner.client.query(api.analytics.getDaySummary, {
        venueId: ctx.venueId,
        today: TODAY,
      }),
    ).toEqual({
      today: { scans: 0, visits: 0, itemOpens: 0, averageDurationMs: null },
      sameDayLastWeek: {
        scans: 0,
        visits: 0,
        itemOpens: 0,
        averageDurationMs: null,
      },
    });
    await expect(
      ctx.stranger.client.query(api.analytics.getDaySummary, {
        venueId: ctx.venueId,
        today: TODAY,
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      ctx.owner.client.query(api.analytics.getDaySummary, {
        venueId: ctx.venueId,
        today: "07/10/2026",
      }),
    ).rejects.toThrow("INVALID_DAY");
  });
});

describe("popular dishes", () => {
  async function seed(ctx: Setup) {
    const dishes = await ctx.t.run(async (db) => {
      const ids: Id<"menuItems">[] = [];
      for (const [index, name] of ["A", "B", "C", "D", "E", "F"].entries()) {
        ids.push(
          await db.db.insert("menuItems", {
            categoryId: ctx.categoryId,
            name,
            priceCents: 1000,
            order: index + 1,
            active: true,
          }),
        );
      }
      return ids;
    });
    const [a, b, c, d, e, f] = dishes as [
      Id<"menuItems">,
      Id<"menuItems">,
      Id<"menuItems">,
      Id<"menuItems">,
      Id<"menuItems">,
      Id<"menuItems">,
    ];
    const opens: [Id<"venues">, Id<"menuItems">, number, number][] = [
      // venue, dish, days before today, opens
      [ctx.venueId, a, 0, 2],
      [ctx.venueId, a, 13, 2], // oldest day of the window: A = 4
      [ctx.venueId, b, 14, 50], // outside the window
      [ctx.venueId, b, 1, 2], // below the threshold
      [ctx.venueId, c, 3, 9],
      [ctx.venueId, d, 5, 3],
      [ctx.venueId, e, 2, 6],
      [ctx.venueId, f, 2, 5],
      [ctx.otherVenueId, ctx.foreignItemId, 0, 99],
    ];
    await ctx.t.run(async (db) => {
      for (const [venueId, itemId, ago, itemOpens] of opens) {
        await db.db.insert("analyticsDaily", {
          venueId,
          day: shiftDay(TODAY, -ago),
          scope: "item",
          key: itemId,
          sessions: 0,
          scans: 0,
          visitors: 0,
          lastSeenVisitors: 0,
          durationMs: 0,
          itemOpens,
          videoPlays: 0,
          videoCompletions: 0,
        });
      }
    });
    return { a, b, c, d, e, f };
  }

  const popular = (ctx: Setup, venueId: string = ctx.venueId, today = TODAY) =>
    ctx.t.query(api.analytics.popularItems, { venueId, today });

  it("returns the four most opened dishes of the last 14 days", async () => {
    const ctx = await setup();
    const { a, c, e, f } = await seed(ctx);
    expect(await popular(ctx)).toEqual([c, e, f, a]);
  });

  it("skips deleted dishes and keeps the threshold", async () => {
    const ctx = await setup();
    const { a, c, d, e, f } = await seed(ctx);
    await ctx.t.run((db) => db.db.delete(e));
    expect(await popular(ctx)).toEqual([c, f, a, d]);
  });

  it("returns nothing for unknown or unpublished venues", async () => {
    const ctx = await setup();
    await seed(ctx);
    expect(await popular(ctx, "not-an-id")).toEqual([]);
    expect(await popular(ctx, ctx.venueId, "2026-10")).toEqual([]);
    await ctx.t.run((db) => db.db.patch(ctx.venueId, { status: "draft" }));
    expect(await popular(ctx)).toEqual([]);
  });
});
