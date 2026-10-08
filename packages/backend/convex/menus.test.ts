/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_IMAGE_BYTES } from "./lib/storage";
import {
  createPublishedVenue,
  createUser,
  newConvexTest,
  NOW,
  storeFile,
  storeImage,
} from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
const HOUR = 60 * 60 * 1000;

async function setup() {
  const t = newConvexTest(modules);
  const owner = await createUser(t, "owner@example.com");
  const stranger = await createUser(t, "stranger@example.com");
  const venue = await createPublishedVenue(owner, "Chez Test");
  return { t, owner, stranger, ...venue };
}

type Setup = Awaited<ReturnType<typeof setup>>;

const getItem = (
  t: Awaited<ReturnType<typeof setup>>["t"],
  id: Id<"menuItems">,
) => t.run((ctx) => ctx.db.get(id));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("allergens and tags", () => {
  it("normalizes them when a dish is created", async () => {
    const { t, owner, categoryId } = await setup();
    const itemId = await owner.client.mutation(api.menus.addItem, {
      categoryId,
      name: "Tiramisu",
      priceCents: 800,
      allergens: ["lait", "oeufs", "gluten", "lait"],
      tags: ["fait-maison", "vegetarien"],
    });
    expect(await getItem(t, itemId)).toMatchObject({
      allergens: ["gluten", "oeufs", "lait"],
      tags: ["vegetarien", "fait-maison"],
    });
  });

  it("distinguishes unknown allergens from none", async () => {
    const { t, owner, categoryId } = await setup();
    const unknown = await owner.client.mutation(api.menus.addItem, {
      categoryId,
      name: "Pain",
      priceCents: 300,
    });
    const none = await owner.client.mutation(api.menus.addItem, {
      categoryId,
      name: "Sorbet",
      priceCents: 600,
      allergens: [],
    });
    expect((await getItem(t, unknown))?.allergens).toBeUndefined();
    expect((await getItem(t, none))?.allergens).toEqual([]);
  });

  it("rejects unknown keys", async () => {
    const { t, owner, categoryId } = await setup();
    await expect(
      owner.client.mutation(api.menus.addItem, {
        categoryId,
        name: "Mystère",
        priceCents: 800,
        allergens: ["arachide"],
      }),
    ).rejects.toThrow("INVALID_ALLERGEN");
    await expect(
      owner.client.mutation(api.menus.addItem, {
        categoryId,
        name: "Mystère",
        priceCents: 800,
        tags: ["bio"],
      }),
    ).rejects.toThrow("INVALID_TAG");
    const items = await t.run((ctx) =>
      ctx.db
        .query("menuItems")
        .withIndex("by_category_order", (q) => q.eq("categoryId", categoryId))
        .take(10),
    );
    expect(items.map((item) => item.name)).toEqual(["Burrata", "Tartare"]);
  });

  it("updates them only when provided", async () => {
    const { t, owner, itemIds } = await setup();
    const itemId = itemIds[0]!;
    const base = { itemId, name: "Burrata", priceCents: 1400 };
    await owner.client.mutation(api.menus.updateItem, {
      ...base,
      allergens: ["lait", "lait"],
      tags: ["signature"],
    });
    expect(await getItem(t, itemId)).toMatchObject({
      allergens: ["lait"],
      tags: ["signature"],
    });

    await owner.client.mutation(api.menus.updateItem, base);
    expect(await getItem(t, itemId)).toMatchObject({
      allergens: ["lait"],
      tags: ["signature"],
    });

    await owner.client.mutation(api.menus.updateItem, {
      ...base,
      allergens: [],
      tags: [],
    });
    expect(await getItem(t, itemId)).toMatchObject({ allergens: [], tags: [] });

    await expect(
      owner.client.mutation(api.menus.updateItem, {
        ...base,
        allergens: ["lait", "noix"],
      }),
    ).rejects.toThrow("INVALID_ALLERGEN");
    await expect(
      owner.client.mutation(api.menus.updateItem, { ...base, tags: ["x"] }),
    ).rejects.toThrow("INVALID_TAG");
    expect((await getItem(t, itemId))?.allergens).toEqual([]);
  });

  it("sends the menu back to draft", async () => {
    const { t, owner, itemIds, menuId } = await setup();
    await owner.client.mutation(api.menus.updateItem, {
      itemId: itemIds[0]!,
      name: "Burrata",
      priceCents: 1400,
      allergens: ["lait"],
    });
    expect((await t.run((ctx) => ctx.db.get(menuId)))?.status).toBe("draft");
  });
});

describe("deleting dishes", () => {
  async function soldOutRows(t: Awaited<ReturnType<typeof setup>>["t"]) {
    return await t.run((ctx) => ctx.db.query("soldOutItems").take(10));
  }

  it("removes the sold-out state of a deleted dish", async () => {
    const { t, owner, itemIds } = await setup();
    for (const itemId of itemIds) {
      await owner.client.mutation(api.service.setSoldOut, {
        itemId,
        soldOut: true,
      });
    }
    await owner.client.mutation(api.menus.deleteItem, { itemId: itemIds[0]! });
    expect((await soldOutRows(t)).map((row) => row.itemId)).toEqual([
      itemIds[1],
    ]);
  });

  it("removes the sold-out state of every dish of a deleted category", async () => {
    const { t, owner, itemIds, categoryId } = await setup();
    for (const itemId of itemIds) {
      await owner.client.mutation(api.service.setSoldOut, {
        itemId,
        soldOut: true,
      });
    }
    await owner.client.mutation(api.menus.deleteCategory, { categoryId });
    expect(await soldOutRows(t)).toEqual([]);
  });
});

describe("published menu", () => {
  it("serves the snapshot without live service state", async () => {
    const { owner, t, slug, venueId } = await setup();
    const published = await t.query(api.menus.getPublishedBySlug, { slug });
    expect(published.venue.name).toBe("Chez Test");
    expect(published.categories[0].items).toHaveLength(2);
    expect(published).not.toHaveProperty("soldOutItemIds");
    expect(published).not.toHaveProperty("special");

    await owner.client.mutation(api.venues.changeSlug, {
      venueId,
      requestedSlug: "chez-test-2",
    });
    expect(await t.query(api.menus.getPublishedBySlug, { slug })).toMatchObject(
      { redirectedFrom: slug, venue: { name: "Chez Test" } },
    );
  });

  it("returns the published snapshot to its owner only", async () => {
    const { t, owner, stranger, menuId, itemIds } = await setup();
    await owner.client.mutation(api.menus.updateItem, {
      itemId: itemIds[0]!,
      name: "Burrata fumée",
      priceCents: 1600,
    });
    const snapshot = await owner.client.query(api.menus.getPublishedSnapshot, {
      menuId,
    });
    expect(snapshot.menu).toMatchObject({ status: "published", version: 1 });
    expect(snapshot.categories[0].items[0]).toMatchObject({
      name: "Burrata",
      priceCents: 1400,
    });
    await expect(
      stranger.client.query(api.menus.getPublishedSnapshot, { menuId }),
    ).rejects.toThrow("Forbidden");

    const draft = await owner.client.mutation(api.venues.create, {
      name: "Jamais publié",
      kind: "Café",
    });
    expect(
      await owner.client.query(api.menus.getPublishedSnapshot, {
        menuId: draft.menuId,
      }),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.get(menuId)).then((menu) => menu?.status),
    ).toBe("draft");
  });
});

describe("opening hours", () => {
  it("normalizes, clears and validates them", async () => {
    const { t, owner, venueId, menuId } = await setup();
    await owner.client.mutation(api.venues.updateProfile, {
      venueId,
      openingHours: [
        { day: 5, ranges: [{ open: "19:00", close: "00:30" }] },
        { day: 6, ranges: [] },
        {
          day: 1,
          ranges: [
            { open: "19:00", close: "22:30" },
            { open: "12:00", close: "14:00" },
          ],
        },
      ],
    });
    const venue = await t.run((ctx) => ctx.db.get(venueId));
    expect(venue?.openingHours).toEqual([
      {
        day: 1,
        ranges: [
          { open: "12:00", close: "14:00" },
          { open: "19:00", close: "22:30" },
        ],
      },
      { day: 5, ranges: [{ open: "19:00", close: "00:30" }] },
    ]);
    expect((await t.run((ctx) => ctx.db.get(menuId)))?.status).toBe("draft");

    await owner.client.mutation(api.venues.updateProfile, {
      venueId,
      name: "Chez Test",
    });
    expect((await t.run((ctx) => ctx.db.get(venueId)))?.openingHours).toEqual(
      venue?.openingHours,
    );

    await expect(
      owner.client.mutation(api.venues.updateProfile, {
        venueId,
        openingHours: [{ day: 2, ranges: [{ open: "12:00", close: "12:00" }] }],
      }),
    ).rejects.toThrow("INVALID_OPENING_HOURS");

    await owner.client.mutation(api.venues.updateProfile, {
      venueId,
      openingHours: [],
    });
    expect(
      (await t.run((ctx) => ctx.db.get(venueId)))?.openingHours,
    ).toBeUndefined();
  });
});

describe("partial dish updates", () => {
  const complete = {
    name: "Burrata",
    description: "Crème de burrata",
    details: "Pouilles",
    priceCents: 1400,
    allergens: ["lait"],
    tags: ["vegetarien"],
    ingredients: ["burrata", "tomate"],
    pairingName: "Vermentino",
    pairingPriceCents: 700,
    reviewRating: 4.8,
    reviewCount: 12,
    reviewQuote: "Divine",
    reviewAuthor: "Léa",
  };

  async function completeItem() {
    const ctx = await setup();
    const itemId = ctx.itemIds[0]!;
    await ctx.owner.client.mutation(api.menus.updateItem, {
      itemId,
      ...complete,
    });
    return { ...ctx, itemId };
  }

  it("only changes the provided fields", async () => {
    const { t, owner, itemId } = await completeItem();
    await owner.client.mutation(api.menus.updateItem, {
      itemId,
      active: false,
    });
    expect(await getItem(t, itemId)).toMatchObject({
      ...complete,
      active: false,
    });

    await owner.client.mutation(api.menus.updateItem, {
      itemId,
      name: "  Burrata crémeuse ",
      priceCents: 1549.6,
      pairingPriceCents: -3,
      ingredients: [" burrata ", "", "basilic"],
    });
    expect(await getItem(t, itemId)).toMatchObject({
      ...complete,
      name: "Burrata crémeuse",
      priceCents: 1550,
      pairingPriceCents: 0,
      ingredients: ["burrata", "basilic"],
      active: false,
    });
  });

  it("removes fields set to null or to an empty text", async () => {
    const { t, owner, itemId } = await completeItem();
    await owner.client.mutation(api.menus.updateItem, {
      itemId,
      description: "  ",
      details: "",
      pairingName: "",
      reviewQuote: "",
      reviewAuthor: "",
      pairingPriceCents: null,
      reviewRating: null,
      reviewCount: null,
      allergens: null,
      tags: [],
      ingredients: [],
    });
    const item = await getItem(t, itemId);
    for (const field of [
      "description",
      "details",
      "pairingName",
      "reviewQuote",
      "reviewAuthor",
      "pairingPriceCents",
      "reviewRating",
      "reviewCount",
      "allergens",
    ]) {
      expect(item).not.toHaveProperty(field);
    }
    expect(item).toMatchObject({
      name: "Burrata",
      priceCents: 1400,
      tags: [],
      ingredients: [],
      active: true,
    });
  });

  it("rejects an empty name", async () => {
    const { t, owner, itemId } = await completeItem();
    await expect(
      owner.client.mutation(api.menus.updateItem, { itemId, name: "   " }),
    ).rejects.toThrow("INVALID_NAME");
    expect((await getItem(t, itemId))?.name).toBe("Burrata");
  });
});

describe("files", () => {
  const fileExists = (t: Setup["t"], storageId: Id<"_storage">) =>
    t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null);

  it("never exposes storage identifiers publicly", async () => {
    const ctx = await setup();
    const [logo, cover] = [await storeImage(ctx.t), await storeImage(ctx.t)];
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
      coverImageStorageId: cover,
    });
    const photo = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.menus.addItemImage, {
      itemId: ctx.itemIds[0]!,
      storageId: photo,
    });
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    const specialPhoto = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.service.setDailySpecial, {
      venueId: ctx.venueId,
      name: "Blanquette",
      priceCents: 1800,
      endsAt: NOW + HOUR,
      imageStorageId: specialPhoto,
    });

    const published = await ctx.t.query(api.menus.getPublishedBySlug, {
      slug: ctx.slug,
    });
    const live = await ctx.t.query(api.menus.getLiveService, {
      venueId: ctx.venueId,
    });
    const json = JSON.stringify([published, live]);
    expect(json).not.toMatch(/StorageId|ownerId/);
    for (const id of [logo, cover, photo, specialPhoto]) {
      expect(json).not.toContain(id);
    }
    expect(published.venue.logoUrl).toEqual(expect.any(String));
    expect(published.venue.coverImageUrl).toEqual(expect.any(String));
    expect(published.categories[0].items[0].media[0].imageUrl).toEqual(
      expect.any(String),
    );
    expect(live.special?.imageUrl).toEqual(expect.any(String));

    const snapshot = await ctx.owner.client.query(
      api.menus.getPublishedSnapshot,
      { menuId: ctx.menuId },
    );
    expect(snapshot.venue.logoStorageId).toBe(logo);
  });

  it("only attaches recent uploads", async () => {
    const ctx = await setup();
    const stale = await storeImage(ctx.t);
    const logo = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
    });

    // convex-test spaces creation times by 1 µs, hence the margin.
    vi.setSystemTime(NOW + HOUR + 1000);
    for (const attach of [
      () =>
        ctx.owner.client.mutation(api.venues.updateAppearance, {
          venueId: ctx.venueId,
          coverImageStorageId: stale,
        }),
      () =>
        ctx.owner.client.mutation(api.menus.addItemImage, {
          itemId: ctx.itemIds[0]!,
          storageId: stale,
        }),
      () =>
        ctx.owner.client.mutation(api.service.setDailySpecial, {
          venueId: ctx.venueId,
          name: "Blanquette",
          priceCents: 1800,
          endsAt: NOW + 2 * HOUR,
          imageStorageId: stale,
        }),
    ]) {
      await expect(attach()).rejects.toThrow("INVALID_IMAGE");
    }
    expect(await ctx.t.run((db) => db.db.get(ctx.venueId))).not.toHaveProperty(
      "coverImageStorageId",
    );
    expect(await fileExists(ctx.t, stale)).toBe(true);

    // The current logo can be sent again, a fresh upload is accepted.
    const fresh = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
      coverImageStorageId: fresh,
    });
    expect(await ctx.t.run((db) => db.db.get(ctx.venueId))).toMatchObject({
      logoStorageId: logo,
      coverImageStorageId: fresh,
    });
  });

  it("requires images of at most 2 MB for the logo and the cover", async () => {
    const ctx = await setup();
    const attempts = [
      { logoStorageId: await storeFile(ctx.t) },
      { logoStorageId: await storeFile(ctx.t, { contentType: "text/html" }) },
      { coverImageStorageId: await storeImage(ctx.t, MAX_IMAGE_BYTES + 1) },
    ];
    for (const files of attempts) {
      await expect(
        ctx.owner.client.mutation(api.venues.updateAppearance, {
          venueId: ctx.venueId,
          ...files,
        }),
      ).rejects.toThrow("INVALID_IMAGE");
    }
    const cover = await storeImage(ctx.t, MAX_IMAGE_BYTES);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      coverImageStorageId: cover,
    });
    const venue = await ctx.t.run((db) => db.db.get(ctx.venueId));
    expect(venue).not.toHaveProperty("logoStorageId");
    expect(venue?.coverImageStorageId).toBe(cover);
  });
});

describe("deleted files", () => {
  const fileExists = (t: Setup["t"], storageId: Id<"_storage">) =>
    t.run(async (ctx) => (await ctx.db.system.get(storageId)) !== null);
  const pending = (t: Setup["t"]) =>
    t.run((ctx) => ctx.db.query("pendingFileDeletions").take(1000));

  async function addPhoto(ctx: Setup, itemId: Id<"menuItems">) {
    const storageId = await storeImage(ctx.t);
    const mediaId = await ctx.owner.client.mutation(api.menus.addItemImage, {
      itemId,
      storageId,
    });
    return { storageId, mediaId };
  }

  it("keeps files shown by the published menu until the next publication", async () => {
    const ctx = await setup();
    const removed = await addPhoto(ctx, ctx.itemIds[0]!);
    const ofDeletedItem = await addPhoto(ctx, ctx.itemIds[1]!);
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });

    await ctx.owner.client.mutation(api.menus.removeMedia, {
      mediaId: removed.mediaId,
    });
    await ctx.owner.client.mutation(api.menus.deleteItem, {
      itemId: ctx.itemIds[1]!,
    });
    expect(await fileExists(ctx.t, removed.storageId)).toBe(true);
    expect(await fileExists(ctx.t, ofDeletedItem.storageId)).toBe(true);
    expect(await pending(ctx.t)).toHaveLength(2);
    const published = await ctx.t.query(api.menus.getPublishedBySlug, {
      slug: ctx.slug,
    });
    expect(published.categories[0].items[0].media[0].imageUrl).toEqual(
      expect.any(String),
    );

    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    expect(await fileExists(ctx.t, removed.storageId)).toBe(false);
    expect(await fileExists(ctx.t, ofDeletedItem.storageId)).toBe(false);
    expect(await pending(ctx.t)).toEqual([]);
  });

  it("queues the files of a deleted category", async () => {
    const ctx = await setup();
    const photo = await addPhoto(ctx, ctx.itemIds[0]!);
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    await ctx.owner.client.mutation(api.menus.deleteCategory, {
      categoryId: ctx.categoryId,
    });
    expect(await fileExists(ctx.t, photo.storageId)).toBe(true);
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    expect(await fileExists(ctx.t, photo.storageId)).toBe(false);
  });

  it("deletes files immediately when the menu was never published", async () => {
    const ctx = await setup();
    const draft = await ctx.owner.client.mutation(api.venues.create, {
      name: "Brouillon",
      kind: "Café",
    });
    const categoryId = await ctx.owner.client.mutation(api.menus.addCategory, {
      menuId: draft.menuId,
      name: "Boissons",
    });
    const itemId = await ctx.owner.client.mutation(api.menus.addItem, {
      categoryId,
      name: "Café",
      priceCents: 200,
    });
    const photo = await addPhoto(ctx, itemId);
    await ctx.owner.client.mutation(api.menus.removeMedia, {
      mediaId: photo.mediaId,
    });
    expect(await fileExists(ctx.t, photo.storageId)).toBe(false);
    expect(await pending(ctx.t)).toEqual([]);
  });

  it("never deletes a file the new snapshot still shows", async () => {
    const ctx = await setup();
    const logo = await storeImage(ctx.t);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
    });
    await ctx.t.run((db) =>
      db.db.insert("pendingFileDeletions", {
        venueId: ctx.venueId,
        storageId: logo,
      }),
    );
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    expect(await fileExists(ctx.t, logo)).toBe(true);
    expect(await pending(ctx.t)).toEqual([]);
  });

  it("deletes queued files in batches", async () => {
    const ctx = await setup();
    const files = await ctx.t.run(async (db) => {
      const ids: Id<"_storage">[] = [];
      for (let i = 0; i < 501; i++) {
        const storageId = await db.storage.store(new Blob([String(i)]));
        await db.db.insert("pendingFileDeletions", {
          venueId: ctx.venueId,
          storageId,
        });
        ids.push(storageId);
      }
      return ids;
    });
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    expect(await pending(ctx.t)).toHaveLength(1);
    await ctx.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await pending(ctx.t)).toEqual([]);
    expect(await fileExists(ctx.t, files[500]!)).toBe(false);
  });
});
