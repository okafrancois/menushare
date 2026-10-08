import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Files can only be attached right after their upload, so a storage
// identifier obtained elsewhere cannot be used to claim (and later delete)
// another venue's file.
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

/**
 * Throws INVALID_IMAGE unless `storageId` is a recent upload (and, when
 * required, an image of at most 2 MB). Rejected fresh uploads are deleted;
 * older files are left alone since they may belong to someone else.
 */
export async function assertFreshUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  options: { requireImage: boolean },
) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  const problem = uploadProblem(metadata, Date.now(), options);
  if (!problem) return;
  if (problem === "notImage") await ctx.storage.delete(storageId);
  throw new Error("INVALID_IMAGE");
}

// Storage identifiers would let anyone claim (then delete) a file, and the
// owner's account id has no business on a public menu.
const PRIVATE_KEY = /StorageId$|^ownerId$/;

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
