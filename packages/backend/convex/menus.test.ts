/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  createPublishedVenue,
  createUser,
  newConvexTest,
  NOW,
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
  it("exposes live service state next to the snapshot", async () => {
    const { owner, t, slug, venueId } = await setup();
    const published = await t.query(api.menus.getPublishedBySlug, { slug });
    expect(published).toMatchObject({
      venue: { name: "Chez Test" },
      soldOutItemIds: [],
      special: null,
    });
    expect(published.categories[0].items).toHaveLength(2);

    await owner.client.mutation(api.venues.changeSlug, {
      venueId,
      requestedSlug: "chez-test-2",
    });
    expect(await t.query(api.menus.getPublishedBySlug, { slug })).toMatchObject(
      {
        redirectedFrom: slug,
        soldOutItemIds: [],
        special: null,
      },
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
  const storeFile = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
    t.run((ctx) => ctx.storage.store(new Blob(["fake image"])));

  it("never exposes storage identifiers publicly", async () => {
    const ctx = await setup();
    const [logo, cover] = [await storeFile(ctx.t), await storeFile(ctx.t)];
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
      coverImageStorageId: cover,
    });
    // convex-test stores files without a content type, so a dish photo is
    // inserted as addItemImage would have done it.
    const photo = await storeFile(ctx.t);
    await ctx.t.run((db) =>
      db.db.insert("media", {
        venueId: ctx.venueId,
        itemId: ctx.itemIds[0]!,
        kind: "image",
        imageStorageId: photo,
        order: 0,
      }),
    );
    await ctx.owner.client.mutation(api.menus.publish, { menuId: ctx.menuId });
    const specialId = await ctx.owner.client.mutation(
      api.service.setDailySpecial,
      {
        venueId: ctx.venueId,
        name: "Blanquette",
        priceCents: 1800,
        endsAt: NOW + HOUR,
      },
    );
    const specialPhoto = await storeFile(ctx.t);
    await ctx.t.run((db) =>
      db.db.patch(specialId, { imageStorageId: specialPhoto }),
    );

    const published = await ctx.t.query(api.menus.getPublishedBySlug, {
      slug: ctx.slug,
    });
    const json = JSON.stringify(published);
    expect(json).not.toMatch(/StorageId/);
    for (const id of [logo, cover, photo, specialPhoto]) {
      expect(json).not.toContain(id);
    }
    expect(published.venue.logoUrl).toEqual(expect.any(String));
    expect(published.venue.coverImageUrl).toEqual(expect.any(String));
    expect(published.categories[0].items[0].media[0].imageUrl).toEqual(
      expect.any(String),
    );
    expect(published.special.imageUrl).toEqual(expect.any(String));

    const snapshot = await ctx.owner.client.query(
      api.menus.getPublishedSnapshot,
      { menuId: ctx.menuId },
    );
    expect(snapshot.venue.logoStorageId).toBe(logo);
  });

  it("only attaches recent uploads", async () => {
    const ctx = await setup();
    const stale = await storeFile(ctx.t);
    const logo = await storeFile(ctx.t);
    await ctx.owner.client.mutation(api.venues.updateAppearance, {
      venueId: ctx.venueId,
      logoStorageId: logo,
    });

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
    expect(
      await ctx.t.run(async (db) => (await db.db.system.get(stale)) !== null),
    ).toBe(true);

    // The current logo can be sent again, a fresh upload is accepted.
    const fresh = await storeFile(ctx.t);
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
});
