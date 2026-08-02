import { describe, expect, it } from "vitest";

import { normalizeExternalVideoUrl } from "./video";

describe("normalizeExternalVideoUrl", () => {
  it("normalizes standard YouTube URLs", () => {
    expect(
      normalizeExternalVideoUrl("https://www.youtube.com/watch?v=abc_DEF-12"),
    ).toEqual({
      provider: "youtube",
      externalId: "abc_DEF-12",
      embedUrl: "https://www.youtube-nocookie.com/embed/abc_DEF-12",
    });
  });

  it("normalizes short YouTube URLs", () => {
    expect(normalizeExternalVideoUrl("https://youtu.be/abc_DEF-12").externalId)
      .toBe("abc_DEF-12");
  });

  it("normalizes Vimeo URLs with tracking disabled", () => {
    expect(normalizeExternalVideoUrl("https://vimeo.com/76979871")).toEqual({
      provider: "vimeo",
      externalId: "76979871",
      embedUrl: "https://player.vimeo.com/video/76979871?dnt=1",
    });
  });

  it("rejects unknown providers", () => {
    expect(() => normalizeExternalVideoUrl("https://example.com/video"))
      .toThrow("UNSUPPORTED_VIDEO_PROVIDER");
  });
});

