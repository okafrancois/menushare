/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { png, validImages } from "./image-fixtures.helpers";
import {
  assertFreshUpload,
  MAX_IMAGE_BYTES,
  UPLOAD_MAX_AGE_MS,
} from "./lib/storage";
import {
  createPublishedVenue,
  createUser,
  newConvexTest,
  NOW,
  storeFile,
  storeImage,
} from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = newConvexTest(modules);
  const owner = await createUser(t, "owner@example.com");
  const stranger = await createUser(t, "stranger@example.com");
  const venue = await createPublishedVenue(owner, "Images");
  return { t, owner, stranger, ...venue };
}

type Setup = Awaited<ReturnType<typeof setup>>;
const claims = (t: Setup["t"]) =>
  t.run((ctx) => ctx.db.query("fileClaims").take(100));
const media = (t: Setup["t"]) =>
  t.run((ctx) => ctx.db.query("media").take(100));
const exists = (t: Setup["t"], id: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.storage.get(id)) !== null);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("transactional image adoption", () => {
  it.each(validImages)(
    "attaches $mime to a dish and appearance",
    async ({ mime, bytes }) => {
      const ctx = await setup();
      const photo = await storeFile(ctx.t, { contentType: mime }, bytes);
      const logo = await storeFile(ctx.t, { contentType: mime }, bytes);
      const mediaId = await ctx.owner.client.mutation(api.menus.addItemImage, {
        itemId: ctx.itemIds[0]!,
        storageId: photo,
        alt: "  Assiette  ",
      });
      await ctx.owner.client.mutation(api.venues.updateAppearance, {
        venueId: ctx.venueId,
        logoStorageId: logo,
        coverImageStorageId: logo,
      });
      expect(await ctx.t.run((db) => db.db.get(mediaId))).toMatchObject({
        imageStorageId: photo,
        alt: "Assiette",
      });
      expect(await ctx.t.run((db) => db.db.get(ctx.venueId))).toMatchObject({
        logoStorageId: logo,
        coverImageStorageId: logo,
      });
      expect(await claims(ctx.t)).toHaveLength(2);
    },
  );

  it("rejects misleading MIME, empty bytes and truncated images without deleting storage or changing the menu", async () => {
    const ctx = await setup();
    for (const [contentType, contents] of [
      ["image/png", new TextEncoder().encode("<html>not an image</html>")],
      ["image/jpeg", png],
      ["image/png", png.slice(0, -1)],
      ["image/png", new Uint8Array()],
      ["image/svg+xml", new TextEncoder().encode("<svg><g></svg>")],
    ] satisfies [string, Uint8Array<ArrayBuffer>][]) {
      const storageId = await storeFile(ctx.t, { contentType }, contents);
      await expect(
        ctx.owner.client.mutation(api.menus.addItemImage, {
          itemId: ctx.itemIds[0]!,
          storageId,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
      await expect(
        ctx.owner.client.mutation(api.venues.updateAppearance, {
          venueId: ctx.venueId,
          logoStorageId: storageId,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
      expect(await exists(ctx.t, storageId)).toBe(true);
    }
    expect(await claims(ctx.t)).toEqual([]);
    expect(await media(ctx.t)).toEqual([]);
    expect(await ctx.t.run((db) => db.db.get(ctx.menuId))).toMatchObject({
      status: "published",
      version: 1,
    });
  });

  it("rejects oversized and expired metadata before reading bytes", async () => {
    const ctx = await setup();
    const tooBig = await storeImage(ctx.t, MAX_IMAGE_BYTES + 1);
    const expired = await storeImage(ctx.t);
    for (const storageId of [tooBig, expired]) {
      if (storageId === expired)
        vi.setSystemTime(NOW + UPLOAD_MAX_AGE_MS + 1000);
      await ctx.t.run(async (db) => {
        const get = vi.spyOn(db.storage, "get");
        await expect(
          assertFreshUpload(db, storageId, {
            requireImage: true,
            venueId: ctx.venueId,
            usage: "menu",
          }),
        ).rejects.toThrow("INVALID_IMAGE");
        expect(get).not.toHaveBeenCalled();
      });
      await expect(
        ctx.owner.client.mutation(api.menus.addItemImage, {
          itemId: ctx.itemIds[0]!,
          storageId,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
      expect(await exists(ctx.t, storageId)).toBe(true);
    }
    expect(await claims(ctx.t)).toEqual([]);
  });

  it("rejects a missing blob", async () => {
    const ctx = await setup();
    const storageId = await storeImage(ctx.t);
    await ctx.t.run((db) => db.storage.delete(storageId));
    await expect(
      ctx.owner.client.mutation(api.menus.addItemImage, {
        itemId: ctx.itemIds[0]!,
        storageId,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    expect(await claims(ctx.t)).toEqual([]);
  });

  it("checks owner authorization before adopting uploads", async () => {
    const ctx = await setup();
    const storageId = await storeImage(ctx.t);
    for (const client of [ctx.t, ctx.stranger.client]) {
      await expect(
        client.mutation(api.menus.addItemImage, {
          itemId: ctx.itemIds[0]!,
          storageId,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.venues.updateAppearance, {
          venueId: ctx.venueId,
          logoStorageId: storageId,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.venues.generateImageUploadUrl, {
          venueId: ctx.venueId,
        }),
      ).rejects.toThrow();
    }
    expect(await exists(ctx.t, storageId)).toBe(true);
    expect(await claims(ctx.t)).toEqual([]);
  });

  it("rolls back initial claims when a later appearance check fails and allows retry", async () => {
    const ctx = await setup();
    const logo = await storeImage(ctx.t);
    const badCover = await storeFile(ctx.t, { contentType: "image/png" });
    await expect(
      ctx.owner.client.mutation(api.venues.updateAppearance, {
        venueId: ctx.venueId,
        logoStorageId: logo,
        coverImageStorageId: badCover,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    await expect(
      ctx.owner.client.mutation(api.venues.updateAppearance, {
        venueId: ctx.venueId,
        logoStorageId: logo,
        accentColor: "bad",
      }),
    ).rejects.toThrow("INVALID_COLOR");
    expect(await claims(ctx.t)).toEqual([]);
    expect(await ctx.t.run((db) => db.db.get(ctx.venueId))).not.toHaveProperty(
      "logoStorageId",
    );
    expect(
      await ctx.t.run((db) => db.db.query("pendingFileDeletions").take(10)),
    ).toEqual([]);
    expect(await exists(ctx.t, logo)).toBe(true);
    expect(await exists(ctx.t, badCover)).toBe(true);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
    });
    vi.setSystemTime(NOW + UPLOAD_MAX_AGE_MS + 1000);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
    });
    expect(await claims(ctx.t)).toHaveLength(1);
  });

  it("does not adopt uploads ignored by appearance removal flags", async () => {
    const ctx = await setup();
    const unused = await storeFile(ctx.t, { contentType: "image/png" });
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: unused,
      coverImageStorageId: unused,
      removeLogo: true,
      removeCoverImage: true,
    });
    expect(await claims(ctx.t)).toEqual([]);
    expect(await exists(ctx.t, unused)).toBe(true);
    const venue = await ctx.t.run((db) => db.db.get(ctx.venueId));
    expect(venue).not.toHaveProperty("logoStorageId");
    expect(venue).not.toHaveProperty("coverImageStorageId");
  });

  it("preserves shared dish photos and refuses the image limit without a false cleanup", async () => {
    const ctx = await setup();
    const storageId = await storeImage(ctx.t);
    const added: Id<"media">[] = [];
    for (let i = 0; i < 8; i++)
      added.push(
        await ctx.owner.client.mutation(api.menus.addItemImage, {
          itemId: ctx.itemIds[0]!,
          storageId,
        }),
      );
    const extra = await storeImage(ctx.t);
    await expect(
      ctx.owner.client.mutation(api.menus.addItemImage, {
        itemId: ctx.itemIds[0]!,
        storageId: extra,
      }),
    ).rejects.toThrow("IMAGE_LIMIT_REACHED");
    expect(await exists(ctx.t, extra)).toBe(true);
    expect(await claims(ctx.t)).toHaveLength(1);
    await ctx.owner.client.mutation(api.menus.removeMedia, {
      mediaId: added[0]!,
    });
    expect(await exists(ctx.t, storageId)).toBe(true);
    await ctx.owner.client.mutation(api.menus.addItemImage, {
      itemId: ctx.itemIds[0]!,
      storageId: extra,
    });
    expect(await media(ctx.t)).toHaveLength(8);
  });

  it("prevents sharing across venues and across deletion lifecycles", async () => {
    const ctx = await setup();
    const other = await createPublishedVenue(ctx.owner, "Autre lieu");
    const strangerVenue = await createPublishedVenue(
      ctx.stranger,
      "Lieu tiers",
    );
    const photo = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.menus.addItemImage, {
      itemId: ctx.itemIds[0]!,
      storageId: photo,
    });
    for (const [client, venue] of [
      [ctx.owner.client, other],
      [ctx.stranger.client, strangerVenue],
    ] satisfies [Setup["owner"]["client"], typeof other][]) {
      await expect(
        client.mutation(api.menus.addItemImage, {
          itemId: venue.itemIds[0]!,
          storageId: photo,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
      await expect(
        client.mutation(api.venues.updateAppearance, {
          venueId: venue.venueId,
          logoStorageId: photo,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
    }
    await expect(
      ctx.owner.client.mutation(api.venues.updateAppearance, {
        venueId: ctx.venueId,
        logoStorageId: photo,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    await expect(
      ctx.owner.client.mutation(api.service.setDailySpecial, {
        venueId: ctx.venueId,
        name: "Plat",
        priceCents: 100,
        endsAt: NOW + 100_000,
        imageStorageId: photo,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    const specialPhoto = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.service.setDailySpecial, {
      venueId: ctx.venueId,
      name: "Plat",
      priceCents: 100,
      endsAt: NOW + 100_000,
      imageStorageId: specialPhoto,
    });
    await expect(
      ctx.owner.client.mutation(api.menus.addItemImage, {
        itemId: ctx.itemIds[0]!,
        storageId: specialPhoto,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    await ctx.owner.client.mutation(api.service.clearDailySpecial, {
      venueId: ctx.venueId,
    });
    expect(await exists(ctx.t, specialPhoto)).toBe(false);
    expect(await exists(ctx.t, photo)).toBe(true);
    expect(await claims(ctx.t)).toHaveLength(1);
  });

  it("protects referenced legacy files and files retained only for published revisions", async () => {
    const ctx = await setup();
    const logo = await storeImage(ctx.t);
    const pending = await storeImage(ctx.t);
    const oldMedia = await storeImage(ctx.t);
    await ctx.t.run(async (db) => {
      await db.db.patch(ctx.venueId, { logoStorageId: logo });
      await db.db.insert("pendingFileDeletions", {
        venueId: ctx.venueId,
        storageId: pending,
      });
      await db.db.insert("media", {
        venueId: ctx.venueId,
        itemId: ctx.itemIds[0]!,
        kind: "image",
        imageStorageId: oldMedia,
        order: 0,
      });
    });
    for (const storageId of [logo, pending, oldMedia]) {
      await expect(
        ctx.owner.client.mutation(api.menus.addItemImage, {
          itemId: ctx.itemIds[1]!,
          storageId,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
      expect(await exists(ctx.t, storageId)).toBe(true);
    }
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
    });
    expect(await claims(ctx.t)).toEqual([]);
  });

  it("allows only one destination to adopt the same unclaimed upload", async () => {
    const ctx = await setup();
    const other = await createPublishedVenue(ctx.owner, "Autre lieu");
    const storageId = await storeImage(ctx.t);
    const results = await Promise.allSettled(
      [ctx.itemIds[0]!, other.itemIds[0]!].map((itemId) =>
        ctx.owner.client.mutation(api.menus.addItemImage, {
          itemId,
          storageId,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await claims(ctx.t)).toHaveLength(1);
    expect(await media(ctx.t)).toHaveLength(1);
    expect(await exists(ctx.t, storageId)).toBe(true);
  });
});
