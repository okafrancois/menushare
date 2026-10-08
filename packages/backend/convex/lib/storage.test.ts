import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BYTES,
  UPLOAD_MAX_AGE_MS,
  uploadProblem,
  withoutPrivateFields,
} from "./storage";

const NOW = 1_800_000_000_000;
const image = { _creationTime: NOW - 1000, contentType: "image/webp", size: 1 };

describe("uploadProblem", () => {
  it("accepts a fresh image", () => {
    expect(uploadProblem(image, NOW, { requireImage: true })).toBeNull();
    expect(
      uploadProblem({ ...image, size: MAX_IMAGE_BYTES }, NOW, {
        requireImage: true,
      }),
    ).toBeNull();
  });

  it("rejects missing files and files older than an hour", () => {
    expect(uploadProblem(null, NOW, { requireImage: false })).toBe("missing");
    expect(
      uploadProblem({ ...image, _creationTime: NOW - UPLOAD_MAX_AGE_MS }, NOW, {
        requireImage: false,
      }),
    ).toBe("expired");
  });

  it("rejects other types and large images when an image is required", () => {
    const pdf = { ...image, contentType: "application/pdf" };
    expect(uploadProblem(pdf, NOW, { requireImage: true })).toBe("notImage");
    expect(uploadProblem(pdf, NOW, { requireImage: false })).toBeNull();
    expect(
      uploadProblem({ ...image, contentType: undefined }, NOW, {
        requireImage: true,
      }),
    ).toBe("notImage");
    expect(
      uploadProblem({ ...image, size: MAX_IMAGE_BYTES + 1 }, NOW, {
        requireImage: true,
      }),
    ).toBe("notImage");
  });
});

describe("withoutPrivateFields", () => {
  it("removes storage identifiers and the owner id at any depth", () => {
    const data = {
      venue: {
        name: "Chez Test",
        ownerId: "user-1",
        logoStorageId: "s1",
        logoUrl: "https://l",
      },
      categories: [
        {
          items: [
            {
              name: "Burrata",
              tags: ["vegetarien"],
              media: [{ imageStorageId: "s2", imageUrl: "https://i" }],
            },
          ],
        },
      ],
      redirectedFrom: undefined,
    };
    expect(withoutPrivateFields(data)).toEqual({
      venue: { name: "Chez Test", logoUrl: "https://l" },
      categories: [
        {
          items: [
            {
              name: "Burrata",
              tags: ["vegetarien"],
              media: [{ imageUrl: "https://i" }],
            },
          ],
        },
      ],
      redirectedFrom: undefined,
    });
    expect(data.venue.logoStorageId).toBe("s1");
  });
});
