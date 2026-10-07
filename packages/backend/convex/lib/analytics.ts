export const ANALYTICS_TIME_ZONE = "Europe/Paris";
export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export const MAX_TABLES = 200;
export const MAX_SESSION_EVENTS = 300;
// A single visit is never credited more than this, even if the tab stays open.
export const MAX_SESSION_MS = 2 * 60 * 60 * 1000;
// Visitors are forgotten once they fall outside the longest reporting period.
export const VISITOR_RETENTION_DAYS = 100;
// Sessions are only needed while their heartbeats can still arrive.
export const SESSION_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

export type AnalyticsCounters = {
  sessions: number;
  scans: number;
  visitors: number;
  lastSeenVisitors: number;
  durationMs: number;
  itemOpens: number;
  videoPlays: number;
  videoCompletions: number;
};

export const EMPTY_COUNTERS: AnalyticsCounters = {
  sessions: 0,
  scans: 0,
  visitors: 0,
  lastSeenVisitors: 0,
  durationMs: 0,
  itemOpens: 0,
  videoPlays: 0,
  videoCompletions: 0,
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day (YYYY-MM-DD) of a timestamp in the venue time zone. */
export function dayKey(timestamp: number) {
  return dayFormatter.format(new Date(timestamp));
}

export function shiftDay(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, date! + delta))
    .toISOString()
    .slice(0, 10);
}

/** The `days` calendar days ending with `today`, oldest first. */
export function periodDays(today: string, days: number) {
  return Array.from({ length: days }, (_, index) =>
    shiftDay(today, index - days + 1),
  );
}

export function addCounters(
  total: AnalyticsCounters,
  row: Partial<AnalyticsCounters>,
): AnalyticsCounters {
  return {
    sessions: total.sessions + (row.sessions ?? 0),
    scans: total.scans + (row.scans ?? 0),
    visitors: total.visitors + (row.visitors ?? 0),
    lastSeenVisitors: total.lastSeenVisitors + (row.lastSeenVisitors ?? 0),
    durationMs: total.durationMs + (row.durationMs ?? 0),
    itemOpens: total.itemOpens + (row.itemOpens ?? 0),
    videoPlays: total.videoPlays + (row.videoPlays ?? 0),
    videoCompletions: total.videoCompletions + (row.videoCompletions ?? 0),
  };
}

export function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Credits a session with the visible time reported by the browser, bounded by
 * the wall-clock time since it started (plus a small allowance for clock
 * skew) and by MAX_SESSION_MS. Returns the new total and the increment.
 */
export function nextSessionDuration(input: {
  previousMs: number;
  reportedMs: number;
  startedAt: number;
  now: number;
}) {
  const ceiling = Math.min(
    MAX_SESSION_MS,
    Math.max(0, input.now - input.startedAt) + 5_000,
  );
  const activeMs = Math.max(
    input.previousMs,
    Math.min(Math.max(0, Math.round(input.reportedMs)), ceiling),
  );
  return { activeMs, deltaMs: activeMs - input.previousMs };
}

const IDENTIFIER = /^[A-Za-z0-9-]{8,64}$/;

export function isAnalyticsIdentifier(value: string) {
  return IDENTIFIER.test(value);
}
