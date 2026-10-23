// Test-only binary fixtures; the double extension excludes this from Convex.
import { readFileSync } from "node:fs";

const base64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const text = (value: string) => new TextEncoder().encode(value);
export const png = base64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAb0AAAAASUVORK5CYII=",
);

function bmp() {
  const bytes = new Uint8Array(58);
  const view = new DataView(bytes.buffer);
  bytes.set(text("BM"));
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setUint32(18, 1, true);
  view.setUint32(22, 1, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, 4, true);
  return bytes;
}

function ico() {
  const bytes = new Uint8Array(22 + png.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  bytes[6] = bytes[7] = 1;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.length, true);
  view.setUint32(18, 22, true);
  bytes.set(png, 22);
  return bytes;
}

function tiff() {
  const bytes = new Uint8Array(123);
  const view = new DataView(bytes.buffer);
  bytes.set(text("II"));
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  const fields = [
    [256, 1],
    [257, 1],
    [258, 8],
    [259, 1],
    [262, 1],
    [273, 122],
    [277, 1],
    [278, 1],
    [279, 1],
  ];
  view.setUint16(8, fields.length, true);
  fields.forEach(([tag, value], index) => {
    const offset = 10 + index * 12;
    view.setUint16(offset, tag!, true);
    view.setUint16(offset + 2, 3, true);
    view.setUint32(offset + 4, 1, true);
    view.setUint16(offset + 8, value!, true);
  });
  return bytes;
}

export const validImages = [
  { mime: "image/png", bytes: png },
  {
    mime: "image/jpeg",
    bytes: new Uint8Array(
      readFileSync(
        new URL("../../../apps/web/public/demo-burrata.jpg", import.meta.url),
      ),
    ),
  },
  {
    mime: "image/webp",
    bytes: base64("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"),
  },
  {
    mime: "image/gif",
    bytes: base64("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  },
  {
    mime: "image/svg+xml",
    bytes: text(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
    ),
  },
  { mime: "image/bmp", bytes: bmp() },
  { mime: "image/x-icon", bytes: ico() },
  { mime: "image/tiff", bytes: tiff() },
  {
    mime: "image/avif",
    bytes: new Uint8Array(
      readFileSync(new URL("./test-images/white_1x1.avif", import.meta.url)),
    ),
  },
  {
    mime: "image/avif",
    bytes: new Uint8Array(
      readFileSync(
        new URL("./test-images/draw_points_idat.avif", import.meta.url),
      ),
    ),
  },
];
