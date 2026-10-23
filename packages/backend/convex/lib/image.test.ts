import { describe, expect, it } from "vitest";

import { png, validImages } from "../image-fixtures.helpers";
import { imageMatchesContentType } from "./image";

describe("bounded image format checks", () => {
  it.each(validImages)("accepts actual $mime bytes", ({ mime, bytes }) => {
    expect(imageMatchesContentType(bytes, mime)).toBe(true);
  });

  it.each(validImages)(
    "rejects truncated $mime containers",
    ({ mime, bytes }) => {
      expect(imageMatchesContentType(bytes.slice(0, -1), mime)).toBe(false);
      expect(imageMatchesContentType(bytes.slice(0, 8), mime)).toBe(false);
    },
  );

  it.each(validImages)("rejects HTML labeled $mime", ({ mime }) => {
    const html = new TextEncoder().encode("<html><body><svg/></body></html>");
    expect(imageMatchesContentType(html, mime)).toBe(false);
  });

  it("matches the claimed format and accepts MIME parameters and common aliases", () => {
    expect(imageMatchesContentType(png, "image/jpeg")).toBe(false);
    expect(imageMatchesContentType(png, "image/png; charset=binary")).toBe(
      true,
    );
    expect(imageMatchesContentType(png, "image/apng")).toBe(true);
    expect(imageMatchesContentType(png, "image/unknown")).toBe(false);
  });

  it("checks chunk lengths, not just magic bytes", () => {
    const bad = png.slice();
    new DataView(bad.buffer).setUint32(8, 0xffffffff);
    expect(imageMatchesContentType(bad, "image/png")).toBe(false);
    expect(
      imageMatchesContentType(
        new TextEncoder().encode("RIFF0000WEBP"),
        "image/webp",
      ),
    ).toBe(false);
    expect(
      imageMatchesContentType(
        new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        "image/jpeg",
      ),
    ).toBe(false);
  });

  it("parses SVG XML, declarations, namespaces and UTF-16 without pretending to sanitize it", () => {
    const xml =
      '<?xml version="1.0"?><!DOCTYPE svg SYSTEM "https://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><s:svg xmlns:s="http://www.w3.org/2000/svg"><s:script>example()</s:script></s:svg>';
    expect(
      imageMatchesContentType(new TextEncoder().encode(xml), "image/svg+xml"),
    ).toBe(true);
    for (const value of [
      "<svg><g></svg>",
      "<!-- <svg/> --><html/>",
      "<svg/><html/>",
      '<svg xmlns="urn:other"/>',
    ]) {
      expect(
        imageMatchesContentType(
          new TextEncoder().encode(value),
          "image/svg+xml",
        ),
      ).toBe(false);
    }
    const utf16 = new Uint8Array([
      0xff,
      0xfe,
      ...Array.from("<svg/>").flatMap((c) => [c.charCodeAt(0), 0]),
    ]);
    expect(imageMatchesContentType(utf16, "image/svg+xml")).toBe(true);
  });

  it("bounds SVG nesting in the mutation parser", () => {
    const bytes = new TextEncoder().encode(
      "<svg>" + "<g>".repeat(256) + "</g>".repeat(256) + "</svg>",
    );
    expect(imageMatchesContentType(bytes, "image/svg+xml")).toBe(false);
  });
});
