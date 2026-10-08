import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./betterAuth/auth";
import {
  addCounters,
  ANALYTICS_PERIODS,
  type AnalyticsCounters,
  dayKey,
  EMPTY_COUNTERS,
  isAnalyticsIdentifier,
  MAX_SESSION_EVENTS,
  MAX_TABLES,
  nextSessionDuration,
  periodDays,
  ratio,
  SESSION_RETENTION_MS,
  shiftDay,
  VISITOR_RETENTION_DAYS,
} from "./lib/analytics";
import { ownedVenueOrThrow } from "./lib/auth";
import { analyticsSource } from "./schema";
import { internalMutation, mutation, query } from "./server";

type Scope = Doc<"analyticsDaily">["scope"];

async function bump(
  ctx: MutationCtx,
  target: { venueId: Id<"venues">; day: string; scope: Scope; key: string },
  delta: Partial<AnalyticsCounters>,
) {
  const row = await ctx.db
    .query("analyticsDaily")
    .withIndex("by_venue_and_scope_and_key_and_day", (q) =>
      q
        .eq("venueId", target.venueId)
        .eq("scope", target.scope)
        .eq("key", target.key)
        .eq("day", target.day),
    )
    .unique();
  if (row) {
    await ctx.db.patch(row._id, addCounters(row, delta));
  } else {
    await ctx.db.insert("analyticsDaily", {
      ...target,
      ...addCounters(EMPTY_COUNTERS, delta),
    });
  }
}

/** Resolves a dish id sent by a browser, only if it belongs to the venue. */
async function venueItemId(
  ctx: QueryCtx,
  venueId: Id<"venues">,
  rawItemId: string,
) {
  const itemId = ctx.db.normalizeId("menuItems", rawItemId);
  const item = itemId ? await ctx.db.get(itemId) : null;
  const category = item ? await ctx.db.get(item.categoryId) : null;
  const menu = category ? await ctx.db.get(category.menuId) : null;
  return menu?.venueId === venueId ? itemId : null;
}

async function startSession(
  ctx: MutationCtx,
  sessionId: string,
  event: {
    venueId: string;
    visitorId: string;
    source: Doc<"analyticsSessions">["source"];
    table?: number;
  },
) {
  if (!isAnalyticsIdentifier(event.visitorId)) return;
  const existing = await ctx.db
    .query("analyticsSessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
  if (existing) return;

  const venueId = ctx.db.normalizeId("venues", event.venueId);
  const venue = venueId ? await ctx.db.get(venueId) : null;
  if (!venueId || !venue || venue.status !== "published") return;

  // Owners previewing their own menu must not inflate their statistics.
  const user = await authComponent.safeGetAuthUser(ctx);
  if (user && user._id === venue.ownerId) return;

  const tableCount = Math.min(venue.tableCount ?? 0, MAX_TABLES);
  const table =
    event.source === "table" &&
    event.table !== undefined &&
    Number.isInteger(event.table) &&
    event.table >= 1 &&
    event.table <= tableCount
      ? event.table
      : undefined;
  // A table that no longer exists still came from a printed QR code.
  const source = event.source === "table" && !table ? "qr" : event.source;

  const now = Date.now();
  const day = dayKey(now);
  await ctx.db.insert("analyticsSessions", {
    venueId,
    sessionId,
    day,
    startedAt: now,
    activeMs: 0,
    source,
    table,
    events: 0,
  });

  const visitor = await ctx.db
    .query("analyticsVisitors")
    .withIndex("by_venue_and_visitor", (q) =>
      q.eq("venueId", venueId).eq("visitorId", event.visitorId),
    )
    .unique();
  let firstVisitToday = true;
  if (!visitor) {
    await ctx.db.insert("analyticsVisitors", {
      venueId,
      visitorId: event.visitorId,
      lastSeenDay: day,
    });
  } else if (visitor.lastSeenDay !== day) {
    const previous = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_venue_and_scope_and_key_and_day", (q) =>
        q
          .eq("venueId", venueId)
          .eq("scope", "venue")
          .eq("key", "")
          .eq("day", visitor.lastSeenDay),
      )
      .unique();
    if (previous && previous.lastSeenVisitors > 0) {
      await ctx.db.patch(previous._id, {
        lastSeenVisitors: previous.lastSeenVisitors - 1,
      });
    }
    await ctx.db.patch(visitor._id, { lastSeenDay: day });
  } else {
    firstVisitToday = false;
  }

  const scanned = source === "direct" ? 0 : 1;
  await bump(
    ctx,
    { venueId, day, scope: "venue", key: "" },
    {
      sessions: 1,
      scans: scanned,
      visitors: firstVisitToday ? 1 : 0,
      lastSeenVisitors: firstVisitToday ? 1 : 0,
    },
  );
  if (table) {
    await bump(
      ctx,
      { venueId, day, scope: "table", key: String(table) },
      { sessions: 1, scans: 1 },
    );
  }
}

export const track = mutation({
  args: {
    sessionId: v.string(),
    event: v.union(
      v.object({
        type: v.literal("start"),
        venueId: v.string(),
        visitorId: v.string(),
        source: analyticsSource,
        table: v.optional(v.number()),
      }),
      v.object({ type: v.literal("heartbeat"), activeMs: v.number() }),
      v.object({ type: v.literal("itemOpen"), itemId: v.string() }),
      v.object({
        type: v.literal("videoPlay"),
        itemId: v.optional(v.string()),
      }),
      v.object({
        type: v.literal("videoComplete"),
        itemId: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { sessionId, event }) => {
    // Tracking is best effort: malformed or unknown input is dropped silently
    // so a visitor's menu never surfaces an error.
    if (!isAnalyticsIdentifier(sessionId)) return null;
    if (event.type === "start") {
      await startSession(ctx, sessionId, event);
      return null;
    }

    const session = await ctx.db
      .query("analyticsSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!session) return null;
    const { venueId, day, table } = session;
    const venueRow = { venueId, day, scope: "venue" as const, key: "" };
    const tableRow = table
      ? { venueId, day, scope: "table" as const, key: String(table) }
      : null;

    if (event.type === "heartbeat") {
      const { activeMs, deltaMs } = nextSessionDuration({
        previousMs: session.activeMs,
        reportedMs: event.activeMs,
        startedAt: session.startedAt,
        now: Date.now(),
      });
      if (deltaMs <= 0) return null;
      await ctx.db.patch(session._id, { activeMs });
      await bump(ctx, venueRow, { durationMs: deltaMs });
      if (tableRow) await bump(ctx, tableRow, { durationMs: deltaMs });
      return null;
    }

    if (session.events >= MAX_SESSION_EVENTS) return null;
    await ctx.db.patch(session._id, { events: session.events + 1 });

    if (event.type === "itemOpen") {
      const itemId = await venueItemId(ctx, venueId, event.itemId);
      if (!itemId) return null;
      await bump(ctx, venueRow, { itemOpens: 1 });
      await bump(
        ctx,
        { ...venueRow, scope: "item", key: itemId },
        {
          itemOpens: 1,
        },
      );
      if (tableRow) await bump(ctx, tableRow, { itemOpens: 1 });
      return null;
    }

    const delta =
      event.type === "videoPlay" ? { videoPlays: 1 } : { videoCompletions: 1 };
    if (event.itemId === undefined) {
      await bump(ctx, { ...venueRow, scope: "cover" }, delta);
    } else {
      const itemId = await venueItemId(ctx, venueId, event.itemId);
      if (!itemId) return null;
      await bump(ctx, { ...venueRow, scope: "item", key: itemId }, delta);
    }
    await bump(ctx, venueRow, delta);
    return null;
  },
});

const ROW_LIMIT = 10_000;

async function periodRows(
  ctx: QueryCtx,
  venueId: Id<"venues">,
  scope: Scope,
  start: string,
  end: string,
) {
  return await ctx.db
    .query("analyticsDaily")
    .withIndex("by_venue_and_scope_and_day", (q) =>
      q
        .eq("venueId", venueId)
        .eq("scope", scope)
        .gte("day", start)
        .lte("day", end),
    )
    .take(ROW_LIMIT);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function assertDay(day: string) {
  if (!DAY.test(day)) throw new Error("INVALID_DAY");
}

function periodTotals(counters: AnalyticsCounters) {
  // Completions are reported by browsers and must never exceed plays.
  const rawCompletionRate = ratio(
    counters.videoCompletions,
    counters.videoPlays,
  );
  return {
    scans: counters.scans,
    visits: counters.sessions,
    uniqueVisitors: counters.lastSeenVisitors,
    averageDurationMs: ratio(counters.durationMs, counters.sessions),
    itemOpens: counters.itemOpens,
    videoPlays: counters.videoPlays,
    videoCompletions: counters.videoCompletions,
    completionRate:
      rawCompletionRate === null ? null : Math.min(1, rawCompletionRate),
  };
}

function groupByKey(rows: Doc<"analyticsDaily">[]) {
  const totals = new Map<string, AnalyticsCounters>();
  for (const row of rows) {
    totals.set(
      row.key,
      addCounters(totals.get(row.key) ?? EMPTY_COUNTERS, row),
    );
  }
  return totals;
}

export const getStats = query({
  args: {
    venueId: v.id("venues"),
    // The browser supplies its current day so the query stays deterministic.
    today: v.string(),
    days: v.number(),
  },
  handler: async (ctx, { venueId, today, days }) => {
    const { venue } = await ownedVenueOrThrow(ctx, venueId);
    assertDay(today);
    if (!(ANALYTICS_PERIODS as readonly number[]).includes(days)) {
      throw new Error("INVALID_PERIOD");
    }
    const calendar = periodDays(today, days);
    const start = calendar[0]!;

    const [venueRows, itemRows, coverRows, tableRows] = await Promise.all(
      (["venue", "item", "cover", "table"] as const).map((scope) =>
        periodRows(ctx, venueId, scope, start, today),
      ),
    );
    // The period of the same length that ends the day before `start`.
    const previousRows = await periodRows(
      ctx,
      venueId,
      "venue",
      shiftDay(start, -days),
      shiftDay(start, -1),
    );

    const totals = venueRows.reduce(addCounters, EMPTY_COUNTERS);
    const byDay = new Map(venueRows.map((row) => [row.day, row]));

    const dishes = await Promise.all(
      [...groupByKey(itemRows)].map(async ([key, counters]) => {
        const itemId = ctx.db.normalizeId("menuItems", key);
        const item = itemId ? await ctx.db.get(itemId) : null;
        return {
          itemId: key,
          name: item?.name ?? null,
          opens: counters.itemOpens,
          videoPlays: counters.videoPlays,
          videoCompletions: counters.videoCompletions,
        };
      }),
    );

    const cover = coverRows.reduce(addCounters, EMPTY_COUNTERS);
    const tableTotals = groupByKey(tableRows);
    const tableCount = Math.min(venue.tableCount ?? 0, MAX_TABLES);
    const tableNumbers = new Set([
      ...Array.from({ length: tableCount }, (_, index) => index + 1),
      ...[...tableTotals.keys()].map(Number),
    ]);

    return {
      period: { start, end: today, days },
      truncated: [venueRows, itemRows, coverRows, tableRows, previousRows].some(
        (rows) => rows.length === ROW_LIMIT,
      ),
      totals: periodTotals(totals),
      previousTotals: periodTotals(
        previousRows.reduce(addCounters, EMPTY_COUNTERS),
      ),
      daily: calendar.map((day) => ({
        day,
        visits: byDay.get(day)?.sessions ?? 0,
        scans: byDay.get(day)?.scans ?? 0,
      })),
      dishes: dishes
        .sort((a, b) => b.opens - a.opens || b.videoPlays - a.videoPlays)
        .slice(0, 100),
      coverVideo:
        cover.videoPlays || cover.videoCompletions
          ? { plays: cover.videoPlays, completions: cover.videoCompletions }
          : null,
      tableCount,
      tables: [...tableNumbers]
        .sort((a, b) => a - b)
        .map((table) => {
          const counters = tableTotals.get(String(table)) ?? EMPTY_COUNTERS;
          return {
            table,
            active: table <= tableCount,
            scans: counters.scans,
            averageDurationMs: ratio(counters.durationMs, counters.sessions),
            itemOpens: counters.itemOpens,
          };
        }),
    };
  },
});

const daySummary = v.object({
  scans: v.number(),
  visits: v.number(),
  itemOpens: v.number(),
  averageDurationMs: v.union(v.number(), v.null()),
});

/** Today's activity next to the same weekday one week earlier. */
export const getDaySummary = query({
  args: {
    venueId: v.id("venues"),
    // The browser supplies its current day so the query stays deterministic.
    today: v.string(),
  },
  returns: v.object({ today: daySummary, sameDayLastWeek: daySummary }),
  handler: async (ctx, { venueId, today }) => {
    await ownedVenueOrThrow(ctx, venueId);
    assertDay(today);
    const summary = async (day: string) => {
      const row = await ctx.db
        .query("analyticsDaily")
        .withIndex("by_venue_and_scope_and_key_and_day", (q) =>
          q
            .eq("venueId", venueId)
            .eq("scope", "venue")
            .eq("key", "")
            .eq("day", day),
        )
        .unique();
      const counters = row ?? EMPTY_COUNTERS;
      return {
        scans: counters.scans,
        visits: counters.sessions,
        itemOpens: counters.itemOpens,
        averageDurationMs: ratio(counters.durationMs, counters.sessions),
      };
    };
    return {
      today: await summary(today),
      sameDayLastWeek: await summary(shiftDay(today, -7)),
    };
  },
});

const POPULAR_DAYS = 14;
const POPULAR_MIN_OPENS = 3;
const POPULAR_LIMIT = 4;
const POPULAR_ROW_LIMIT = 3000;

/**
 * Public: the most opened dishes of a published menu over the last two weeks,
 * most popular first. Only identifiers are exposed, never the counters.
 */
export const popularItems = query({
  args: { venueId: v.string(), today: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    if (!DAY.test(args.today)) return [];
    const venueId = ctx.db.normalizeId("venues", args.venueId);
    const venue = venueId ? await ctx.db.get("venues", venueId) : null;
    if (!venueId || !venue || venue.status !== "published") return [];

    const rows = await ctx.db
      .query("analyticsDaily")
      .withIndex("by_venue_and_scope_and_day", (q) =>
        q
          .eq("venueId", venueId)
          .eq("scope", "item")
          .gte("day", shiftDay(args.today, 1 - POPULAR_DAYS))
          .lte("day", args.today),
      )
      .take(POPULAR_ROW_LIMIT);
    const ranked = [...groupByKey(rows)]
      .map(([itemId, counters]) => ({ itemId, opens: counters.itemOpens }))
      .filter(({ opens }) => opens >= POPULAR_MIN_OPENS)
      .sort((a, b) => b.opens - a.opens || a.itemId.localeCompare(b.itemId));

    // Deleted dishes keep their counters; skip them.
    const popular: string[] = [];
    for (const { itemId } of ranked) {
      if (popular.length === POPULAR_LIMIT) break;
      const id = ctx.db.normalizeId("menuItems", itemId);
      if (id && (await ctx.db.get("menuItems", id))) popular.push(itemId);
    }
    return popular;
  },
});

const PURGE_BATCH = 500;

export const purgeExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db
      .query("analyticsSessions")
      .withIndex("by_started_at", (q) =>
        q.lt("startedAt", now - SESSION_RETENTION_MS),
      )
      .take(PURGE_BATCH);
    for (const session of sessions) await ctx.db.delete(session._id);

    const visitors = await ctx.db
      .query("analyticsVisitors")
      .withIndex("by_last_seen_day", (q) =>
        q.lt("lastSeenDay", shiftDay(dayKey(now), -VISITOR_RETENTION_DAYS)),
      )
      .take(PURGE_BATCH);
    for (const visitor of visitors) await ctx.db.delete(visitor._id);

    if (sessions.length === PURGE_BATCH || visitors.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.analytics.purgeExpired, {});
    }
    return null;
  },
});
