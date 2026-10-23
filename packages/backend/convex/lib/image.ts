import { SaxesParser } from "saxes";

/**
 * Bounded format/framing checks, not image decoding, malware detection or SVG
 * sanitization. The uploader passes small image/* files through unchanged, so
 * keep SVG, animated and less common browser image formats as well as photos.
 */
export function imageMatchesContentType(
  bytes: Uint8Array,
  contentType: string,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = (offset: number, text: string) =>
    offset >= 0 &&
    offset + text.length <= bytes.length &&
    [...text].every(
      (character, i) => bytes[offset + i] === character.charCodeAt(0),
    );
  const u16 = (offset: number, little = false) =>
    view.getUint16(offset, little);
  const u32 = (offset: number, little = false) =>
    view.getUint32(offset, little);
  const mime = contentType.split(";", 1)[0]?.trim().toLowerCase();

  // All integer reads below are guarded by a containing header/chunk length.
  if (mime === "image/png" || mime === "image/apng") {
    if (!at(0, "\x89PNG\r\n\x1a\n")) return false;
    let hasData = false;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = u32(offset);
      if (length > bytes.length - offset - 12) return false;
      if (
        offset === 8 &&
        (!at(offset + 4, "IHDR") ||
          length !== 13 ||
          !u32(offset + 8) ||
          !u32(offset + 12))
      )
        return false;
      if (at(offset + 4, "IDAT") && length > 0) hasData = true;
      if (at(offset + 4, "IEND")) return length === 0 && hasData;
      offset += length + 12;
    }
    return false;
  }

  if (["image/jpeg", "image/jpg", "image/pjpeg"].includes(mime ?? "")) {
    if (!at(0, "\xff\xd8")) return false;
    let frame = false;
    let scan = false;
    let data = false;
    for (let offset = 2; offset < bytes.length;) {
      if (bytes[offset++] !== 0xff) {
        if (!scan) return false;
        data = true;
        continue;
      }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9) return frame && scan && data;
      if (
        scan &&
        (marker === 0 ||
          (marker !== undefined && marker >= 0xd0 && marker <= 0xd7))
      )
        continue;
      if (offset + 2 > bytes.length) return false;
      const length = u16(offset);
      if (length < 2 || length > bytes.length - offset) return false;
      if (
        marker !== undefined &&
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        if (length < 8 || !u16(offset + 3) || !u16(offset + 5)) return false;
        frame = true;
      }
      if (marker === 0xda) {
        if (!frame || length < 6) return false;
        scan = true;
      }
      offset += length;
    }
    return false;
  }

  if (mime === "image/gif") {
    if (
      bytes.length < 13 ||
      (!at(0, "GIF87a") && !at(0, "GIF89a")) ||
      !u16(6, true) ||
      !u16(8, true)
    )
      return false;
    let offset = 13 + (bytes[10]! & 0x80 ? 3 * 2 ** ((bytes[10]! & 7) + 1) : 0);
    let frame = false;
    while (offset < bytes.length) {
      const kind = bytes[offset++];
      if (kind === 0x3b) return frame;
      if (kind === 0x2c) {
        if (
          offset + 9 > bytes.length ||
          !u16(offset + 4, true) ||
          !u16(offset + 6, true)
        )
          return false;
        const packed = bytes[offset + 8]!;
        offset += 9 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
        if (offset >= bytes.length || bytes[offset]! < 2 || bytes[offset]! > 8)
          return false;
        offset++; // LZW minimum code size; do not decompress.
      } else if (kind === 0x21) {
        offset++; // Extension label.
      } else return false;
      let payload = false;
      while (true) {
        if (offset >= bytes.length) return false;
        const length = bytes[offset++]!;
        if (!length) break;
        if (length > bytes.length - offset) return false;
        payload = true;
        offset += length;
      }
      if (kind === 0x2c) {
        if (!payload) return false;
        frame = true;
      }
    }
    return false;
  }

  if (mime === "image/webp") {
    if (
      bytes.length < 20 ||
      !at(0, "RIFF") ||
      !at(8, "WEBP") ||
      u32(4, true) + 8 !== bytes.length
    )
      return false;
    const chunks = (
      start: number,
      end: number,
      animation: boolean,
    ): boolean => {
      let frame = false;
      let offset = start;
      while (offset + 8 <= end) {
        const length = u32(offset + 4, true);
        const payload = offset + 8;
        const next = payload + length + (length % 2);
        if (next > end) return false;
        if (at(offset, "VP8 ")) {
          if (length < 10 || !at(payload + 3, "\x9d\x01\x2a")) return false;
          frame = true;
        } else if (at(offset, "VP8L")) {
          if (length < 5 || bytes[payload] !== 0x2f) return false;
          frame = true;
        } else if (animation && at(offset, "ANMF")) {
          if (length < 24 || !chunks(payload + 16, payload + length, false))
            return false;
          frame = true;
        }
        offset = next;
      }
      return offset === end && frame;
    };
    return chunks(12, bytes.length, true);
  }

  if (mime === "image/svg+xml") {
    // A streaming XML parser avoids building a DOM or resolving external
    // resources. A well-formed SVG can still contain active/external content.
    try {
      const encoding =
        at(0, "\xff\xfe") || at(0, "<\0")
          ? "utf-16le"
          : at(0, "\xfe\xff") || at(0, "\0<")
            ? "utf-16be"
            : "utf-8";
      const parser = new SaxesParser({ xmlns: true });
      let root: boolean | undefined;
      let depth = 0;
      parser.on("opentag", (tag) => {
        // Avoid a deeply nested XML document exhausting mutation memory.
        if (++depth > 256) throw new Error("SVG nesting limit");
        root ??=
          tag.local === "svg" &&
          (tag.uri === "" || tag.uri === "http://www.w3.org/2000/svg");
      });
      parser.on("closetag", () => {
        depth--;
      });
      parser
        .write(new TextDecoder(encoding, { fatal: true }).decode(bytes))
        .close();
      return root === true;
    } catch {
      return false;
    }
  }

  if (["image/bmp", "image/x-ms-bmp"].includes(mime ?? "")) {
    if (bytes.length < 26 || !at(0, "BM")) return false;
    const header = u32(14, true);
    const pixels = u32(10, true);
    return (
      header >= 12 &&
      header <= bytes.length - 14 &&
      pixels >= 14 + header &&
      pixels < bytes.length &&
      u32(2, true) === bytes.length
    );
  }

  if (["image/x-icon", "image/vnd.microsoft.icon"].includes(mime ?? "")) {
    if (bytes.length < 6 || !at(0, "\0\0\x01\0")) return false;
    const count = u16(4, true);
    const directoryEnd = 6 + count * 16;
    if (!count || directoryEnd > bytes.length) return false;
    for (let offset = 6; offset < directoryEnd; offset += 16) {
      const size = u32(offset + 8, true);
      const start = u32(offset + 12, true);
      if (!size || start < directoryEnd || start + size > bytes.length)
        return false;
    }
    return true;
  }

  if (["image/tiff", "image/x-tiff"].includes(mime ?? "")) {
    if (bytes.length < 8 || (!at(0, "II\x2a\0") && !at(0, "MM\0\x2a")))
      return false;
    const little = bytes[0] === 0x49;
    const directory = u32(4, little);
    if (directory < 8 || directory + 2 > bytes.length) return false;
    const count = u16(directory, little);
    if (!count || directory + 2 + count * 12 + 4 > bytes.length) return false;
    let offsets: number[] = [];
    let sizes: number[] = [];
    for (
      let entry = directory + 2;
      entry < directory + 2 + count * 12;
      entry += 12
    ) {
      const tag = u16(entry, little);
      if (![273, 279, 324, 325].includes(tag)) continue;
      if (tag === 273 || tag === 324 ? offsets.length > 0 : sizes.length > 0)
        return false;
      const type = u16(entry + 2, little);
      const width = type === 3 ? 2 : type === 4 ? 4 : 0;
      const items = u32(entry + 4, little);
      if (!width || !items || items * width > bytes.length) return false;
      const start = items * width <= 4 ? entry + 8 : u32(entry + 8, little);
      if (start + items * width > bytes.length) return false;
      const values = Array.from({ length: items }, (_, i) =>
        width === 2
          ? u16(start + i * width, little)
          : u32(start + i * width, little),
      );
      if (tag === 273 || tag === 324) offsets = values;
      else sizes = values;
    }
    return (
      offsets.length > 0 &&
      offsets.length === sizes.length &&
      offsets.every(
        (offset, i) => sizes[i]! > 0 && offset + sizes[i]! <= bytes.length,
      )
    );
  }

  if (
    [
      "image/avif",
      "image/avif-sequence",
      "image/heif",
      "image/heic",
      "image/heif-sequence",
      "image/heic-sequence",
    ].includes(mime ?? "")
  ) {
    if (bytes.length < 16 || !at(4, "ftyp")) return false;
    const brands = mime?.startsWith("image/avif")
      ? ["avif", "avis"]
      : mime?.startsWith("image/heic")
        ? ["heic", "heix", "hevc", "hevx"]
        : ["mif1", "msf1", "heic", "heix", "hevc", "hevx"];
    const ftypSize = u32(0);
    if (ftypSize < 16 || ftypSize > bytes.length || ftypSize % 4) return false;
    let brand = brands.some((value) => at(8, value));
    for (let offset = 16; offset < ftypSize; offset += 4)
      brand ||= brands.some((value) => at(offset, value));
    if (!brand) return false;
    let meta = false;
    let data = false;
    let offset = ftypSize;
    while (offset + 8 <= bytes.length) {
      let size = u32(offset);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > bytes.length || u32(offset + 8) !== 0) return false;
        size = u32(offset + 12);
        header = 16;
      } else if (size === 0) size = bytes.length - offset;
      if (size < header || size > bytes.length - offset) return false;
      if (at(offset + 4, "meta") && size > header + 4) {
        meta = true;
        // HEIF/AVIF may store image data inside meta, instead of mdat.
        let child = offset + header + 4;
        const end = offset + size;
        while (child + 8 <= end) {
          const childSize = u32(child) || end - child;
          if (childSize < 8 || childSize > end - child) return false;
          if (at(child + 4, "idat") && childSize > 8) data = true;
          child += childSize;
        }
        if (child !== end) return false;
      }
      if (at(offset + 4, "mdat") && size > header) data = true;
      offset += size;
    }
    return offset === bytes.length && meta && data;
  }

  if (mime === "image/jxl") {
    if (at(0, "\xff\x0a")) return bytes.length > 2;
    if (!at(0, "\0\0\0\x0cJXL \r\n\x87\n")) return false;
    let offset = 12;
    let data = false;
    while (offset + 8 <= bytes.length) {
      const size = u32(offset);
      if (size < 8 || size > bytes.length - offset) return false;
      if (
        (at(offset + 4, "jxlc") && size > 8) ||
        (at(offset + 4, "jxlp") && size > 12)
      )
        data = true;
      offset += size;
    }
    return offset === bytes.length && data;
  }
  return false;
}
