import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatRate,
  menuQrUrl,
  playerApiUrl,
  readVisitSource,
  statsDay,
  VISITOR_LIFETIME_MS,
  visitorIdFrom,
} from "./menu-analytics";

describe("visit source", () => {
  it("recognises venue and table QR codes", () => {
    expect(readVisitSource("?src=qr")).toEqual({
      source: "qr",
      cleanedSearch: "",
    });
    expect(readVisitSource("?t=12&lang=fr")).toEqual({
      source: "table",
      table: 12,
      cleanedSearch: "?lang=fr",
    });
  });

  it("treats a malformed table as a plain scan and no parameter as direct", () => {
    expect(readVisitSource("?t=abc").source).toBe("qr");
    expect(readVisitSource("?t=0").source).toBe("qr");
    expect(readVisitSource("")).toEqual({
      source: "direct",
      cleanedSearch: "",
    });
  });

  it("builds QR URLs that round-trip", () => {
    const url = "https://menushare.app/menu/chez-test";
    expect(menuQrUrl(url)).toBe(`${url}?src=qr`);
    expect(readVisitSource(new URL(menuQrUrl(url, 7)).search)).toMatchObject({
      source: "table",
      table: 7,
    });
  });
});

describe("visitor identifier", () => {
  const now = 1_800_000_000_000;

  it("reuses a recent identifier", () => {
    const stored = JSON.stringify({
      id: "visitor-1234",
      createdAt: now - 1000,
    });
    expect(visitorIdFrom(stored, now, () => "new-id")).toEqual({
      id: "visitor-1234",
    });
  });

  it("renews expired or corrupted identifiers", () => {
    const expired = JSON.stringify({
      id: "visitor-1234",
      createdAt: now - VISITOR_LIFETIME_MS,
    });
    expect(visitorIdFrom(expired, now, () => "new-id").id).toBe("new-id");
    expect(visitorIdFrom("{oops", now, () => "new-id")).toEqual({
      id: "new-id",
      stored: JSON.stringify({ id: "new-id", createdAt: now }),
    });
  });
});

describe("player API URL", () => {
  it("enables the YouTube JavaScript API and leaves Vimeo untouched", () => {
    expect(
      playerApiUrl(
        {
          provider: "youtube",
          embedUrl: "https://www.youtube-nocookie.com/embed/abc123",
        },
        "https://menushare.app",
      ),
    ).toBe(
      "https://www.youtube-nocookie.com/embed/abc123?enablejsapi=1&origin=https%3A%2F%2Fmenushare.app",
    );
    const vimeo = "https://player.vimeo.com/video/76979871?dnt=1";
    expect(
      playerApiUrl({ provider: "vimeo", embedUrl: vimeo }, "https://a.b"),
    ).toBe(vimeo);
  });
});

describe("statistics formatting", () => {
  it("uses Paris days", () => {
    expect(statsDay(Date.UTC(2026, 9, 7, 22, 30))).toBe("2026-10-08");
  });

  it("formats durations and rates", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(42_400)).toBe("42 s");
    expect(formatDuration(125_000)).toBe("2 min 05");
    expect(formatDuration(180_000)).toBe("3 min");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(2 / 3)).toBe("67 %");
  });
});
