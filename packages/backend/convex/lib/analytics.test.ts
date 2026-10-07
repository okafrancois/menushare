import { describe, expect, it } from "vitest";

import {
  dayKey,
  isAnalyticsIdentifier,
  MAX_SESSION_MS,
  nextSessionDuration,
  periodDays,
  shiftDay,
} from "./analytics";

describe("analytics calendar", () => {
  it("uses the Paris calendar day", () => {
    expect(dayKey(Date.UTC(2026, 9, 7, 21, 59))).toBe("2026-10-07");
    expect(dayKey(Date.UTC(2026, 9, 7, 22, 1))).toBe("2026-10-08");
  });

  it("shifts days across month and year boundaries", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("lists the period ending today, oldest first", () => {
    expect(periodDays("2026-10-02", 3)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });
});

describe("session duration", () => {
  const startedAt = 1_000_000;

  it("credits the visible time reported by the browser", () => {
    expect(
      nextSessionDuration({
        previousMs: 10_000,
        reportedMs: 25_000,
        startedAt,
        now: startedAt + 60_000,
      }),
    ).toEqual({ activeMs: 25_000, deltaMs: 15_000 });
  });

  it("never exceeds the wall-clock time since the visit started", () => {
    expect(
      nextSessionDuration({
        previousMs: 0,
        reportedMs: 600_000,
        startedAt,
        now: startedAt + 30_000,
      }),
    ).toEqual({ activeMs: 35_000, deltaMs: 35_000 });
  });

  it("never goes backwards and is capped", () => {
    expect(
      nextSessionDuration({
        previousMs: 20_000,
        reportedMs: 5_000,
        startedAt,
        now: startedAt + 60_000,
      }).deltaMs,
    ).toBe(0);
    expect(
      nextSessionDuration({
        previousMs: 0,
        reportedMs: Number.MAX_SAFE_INTEGER,
        startedAt,
        now: startedAt + 10 * MAX_SESSION_MS,
      }).activeMs,
    ).toBe(MAX_SESSION_MS);
  });
});

describe("identifiers", () => {
  it("accepts random UUIDs and rejects anything else", () => {
    expect(isAnalyticsIdentifier(crypto.randomUUID())).toBe(true);
    expect(isAnalyticsIdentifier("short")).toBe(false);
    expect(isAnalyticsIdentifier("x".repeat(65))).toBe(false);
    expect(isAnalyticsIdentifier("abc def ghi")).toBe(false);
  });
});
