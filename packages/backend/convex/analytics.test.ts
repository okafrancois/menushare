/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import type { FunctionArgs } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { dayKey } from "./lib/analytics";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = Date.UTC(2026, 9, 7, 12, 0);
const TODAY = dayKey(NOW);

async function createUser(t: ReturnType<typeof convexTest>, email: string) {
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

async function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
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
    return { venueId, itemId, foreignItemId };
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
