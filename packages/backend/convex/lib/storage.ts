import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { imageMatchesContentType } from "./image";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Freshness limits initial adoption; it is not proof of file ownership.
export const UPLOAD_MAX_AGE_MS = 60 * 60 * 1000;

type FileMetadata = {
  _creationTime: number;
  contentType?: string;
  size: number;
};

export type UploadProblem = "missing" | "expired" | "notImage";

export function uploadProblem(
  metadata: FileMetadata | null,
  now: number,
  options: { requireImage: boolean },
): UploadProblem | null {
  if (!metadata) return "missing";
  if (now - metadata._creationTime >= UPLOAD_MAX_AGE_MS) return "expired";
  if (
    options.requireImage &&
    (!metadata.contentType?.startsWith("image/") ||
      metadata.size > MAX_IMAGE_BYTES)
  ) {
    return "notImage";
  }
  return null;
}

export async function deleteFileIfPresent(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  if (await ctx.db.system.get("_storage", storageId)) {
    await ctx.storage.delete(storageId);
  }
  const claim = await ctx.db
    .query("fileClaims")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (claim) await ctx.db.delete(claim._id);
}

/**
 * Called only after authorizing the destination venue. Adoption and validation
 * commit together. A file may be shared within one usage at one venue, whose
 * release paths know how to retain its other references.
 * Refusals leave storage untouched: deleting then throwing would roll back,
 * and a fresh id alone never authorizes deleting someone else's upload.
 */
export async function assertFreshUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  options: {
    requireImage: boolean;
    venueId: Id<"venues">;
    usage: "menu" | "appearance" | "special";
  },
) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  const problem = uploadProblem(metadata, Date.now(), options);
  if (problem || !metadata) throw new Error("INVALID_IMAGE");
  const claim = await ctx.db
    .query("fileClaims")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (
    claim &&
    (claim.venueId !== options.venueId ||
      claim.usage !== options.usage ||
      options.usage === "special")
  ) {
    throw new Error("INVALID_IMAGE");
  }

  // Legacy references predate fileClaims. Indexed existence checks also
  // protect files kept only by restorable publications (pending deletions).
  if (!claim) {
    const media = await ctx.db
      .query("media")
      .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
      .first();
    const logo = await ctx.db
      .query("venues")
      .withIndex("by_logoStorageId", (q) => q.eq("logoStorageId", storageId))
      .first();
    const cover = await ctx.db
      .query("venues")
      .withIndex("by_coverImageStorageId", (q) =>
        q.eq("coverImageStorageId", storageId),
      )
      .first();
    const special = await ctx.db
      .query("dailySpecials")
      .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
      .first();
    const pending = await ctx.db
      .query("pendingFileDeletions")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    // Existing appearance/special edits bypass initial adoption at the caller.
    // Without a claim, no referenced legacy file is a new upload to adopt.
    if (pending || media || logo || cover || special) {
      throw new Error("INVALID_IMAGE");
    }
  }
  if (options.requireImage) {
    // Check metadata BEFORE downloading. Each call reads at most one 2 MiB
    // blob; appearance adopts at most two, without scanning/decompressing pixels.
    const blob = await ctx.storage.get(storageId);
    if (
      !blob ||
      blob.size !== metadata.size ||
      blob.size > MAX_IMAGE_BYTES ||
      !imageMatchesContentType(
        new Uint8Array(await blob.arrayBuffer()),
        metadata.contentType ?? "",
      )
    ) {
      throw new Error("INVALID_IMAGE");
    }
  }
  if (!claim)
    await ctx.db.insert("fileClaims", {
      storageId,
      venueId: options.venueId,
      usage: options.usage,
    });
}

const STORAGE_ID_KEY = /StorageId$/;
// Storage identifiers would let anyone claim (then delete) a file, and the
// owner's account id has no business on a public menu.
const PRIVATE_KEY = /StorageId$|^ownerId$/;

/** Every storage identifier (`…StorageId` field) found in a published menu. */
export function storageIdsIn(
  value: unknown,
  found: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) storageIdsIn(entry, found);
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (STORAGE_ID_KEY.test(key) && typeof entry === "string") {
        found.add(entry);
      } else {
        storageIdsIn(entry, found);
      }
    }
  }
  return found;
}

/**
 * Deep copy of a published menu without private fields (`…StorageId`,
 * `ownerId`), for public responses: visitors only need the signed URLs.
 */
export function withoutPrivateFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => withoutPrivateFields(entry)) as T;
  }
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !PRIVATE_KEY.test(key))
        .map(([key, entry]) => [key, withoutPrivateFields(entry)]),
    ) as T;
  }
  return value;
}
