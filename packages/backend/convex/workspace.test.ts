/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  createPublishedVenue,
  createUser,
  newConvexTest,
  NOW,
  storeImage,
} from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = newConvexTest(modules);
  const owner = await createUser(t, "owner@example.com");
  const stranger = await createUser(t, "stranger@example.com");
  return {
    t,
    owner,
    stranger,
    ...(await createPublishedVenue(owner, "Chez Test")),
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("cycle de vie d’un établissement", () => {
  it("garde les QR valides après deux changements d’adresse, puis respecte le retrait et la republication", async () => {
    const { t, owner, venueId, menuId, slug } = await setup();
    await owner.client.mutation(api.venues.changeSlug, {
      venueId,
      requestedSlug: "chez-test-deux",
    });
    await owner.client.mutation(api.venues.changeSlug, {
      venueId,
      requestedSlug: "chez-test-trois",
    });
    for (const address of [slug, "chez-test-deux", "chez-test-trois"]) {
      expect(
        await t.query(api.menus.getPublishedBySlug, { slug: address }),
      ).toMatchObject({ venue: { slug: "chez-test-trois" } });
    }
    for (const status of ["draft", "archived"] as const) {
      await owner.client.mutation(api.venues.setStatus, { venueId, status });
      expect(await t.query(api.menus.getPublishedBySlug, { slug })).toBeNull();
    }
    await owner.client.mutation(api.venues.setStatus, {
      venueId,
      status: "draft",
    });
    await owner.client.mutation(api.menus.publish, { menuId });
    expect(await t.query(api.menus.getPublishedBySlug, { slug })).toMatchObject(
      { venue: { slug: "chez-test-trois" } },
    );
  });

  it("retire immédiatement une carte et efface ses données sans toucher à un autre propriétaire", async () => {
    const { t, owner, stranger, venueId, menuId, categoryId, itemIds, slug } =
      await setup();
    const other = await createPublishedVenue(stranger, "Autre restaurant");
    const photo = await storeImage(t);
    await owner.client.mutation(api.menus.addItemImage, {
      itemId: itemIds[0]!,
      storageId: photo,
    });
    await owner.client.mutation(api.menus.publish, { menuId });
    await expect(
      stranger.client.mutation(api.venues.remove, {
        venueId,
        confirmName: "Chez Test",
      }),
    ).rejects.toThrow("Forbidden");
    await expect(
      owner.client.mutation(api.venues.remove, {
        venueId,
        confirmName: "Erreur",
      }),
    ).rejects.toThrow("CONFIRM_NAME");
    await owner.client.mutation(api.venues.remove, {
      venueId,
      confirmName: "Chez Test",
    });
    expect(await t.query(api.menus.getPublishedBySlug, { slug })).toBeNull();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run(async (ctx) => ({
        venue: await ctx.db.get(venueId),
        menu: await ctx.db.get(menuId),
        category: await ctx.db.get(categoryId),
        photo: await ctx.db.system.get(photo),
        snapshots: await ctx.db
          .query("menuSnapshots")
          .withIndex("by_venue", (q) => q.eq("venueId", venueId))
          .take(20),
      })),
    ).toEqual({
      venue: null,
      menu: null,
      category: null,
      photo: null,
      snapshots: [],
    });
    expect(
      (await t.query(api.menus.getPublishedBySlug, { slug: other.slug })).venue
        .name,
    ).toBe("Autre restaurant");
  });

  it("supprime tous les établissements d’un compte", async () => {
    const { t, owner, venueId } = await setup();
    const second = await createPublishedVenue(owner, "Deuxième");
    await t.mutation(internal.venues.removeAccountData, { ownerId: owner.id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(venueId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(second.venueId))).toBeNull();
  });
});

describe("brouillon et historique", () => {
  it("conserve l’ancien logo pour l’historique puis le supprime à l’expiration de sa version", async () => {
    const { t, owner, venueId, menuId } = await setup();
    const first = await storeImage(t),
      second = await storeImage(t);
    await owner.client.mutation(api.venues.updateAppearance, {
      venueId,
      logoStorageId: first,
    });
    await owner.client.mutation(api.menus.publish, { menuId });
    await owner.client.mutation(api.venues.updateAppearance, {
      venueId,
      logoStorageId: second,
    });
    await owner.client.mutation(api.menus.publish, { menuId });
    expect(await t.run((ctx) => ctx.db.system.get(first))).not.toBeNull();
    for (let index = 0; index < 9; index++)
      await owner.client.mutation(api.menus.publish, { menuId });
    expect(await t.run((ctx) => ctx.db.system.get(first))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(second))).not.toBeNull();
    expect(
      await owner.client.query(api.menus.listVersions, { menuId }),
    ).toHaveLength(10);
  });

  it("restaure les images et le contenu sans changer la carte publique ni son adresse", async () => {
    const { t, owner, stranger, venueId, menuId, categoryId, itemIds, slug } =
      await setup();
    const photo = await storeImage(t);
    await owner.client.mutation(api.menus.addItemImage, {
      itemId: itemIds[0]!,
      storageId: photo,
    });
    await owner.client.mutation(api.menus.publish, { menuId });
    await owner.client.mutation(api.menus.deleteCategory, { categoryId });
    await owner.client.mutation(api.menus.publish, { menuId });
    await owner.client.mutation(api.venues.changeSlug, {
      venueId,
      requestedSlug: "nouvelle-adresse",
    });
    await expect(
      stranger.client.mutation(api.menus.restoreVersion, {
        menuId,
        version: 2,
      }),
    ).rejects.toThrow("Forbidden");
    await owner.client.mutation(api.menus.restoreVersion, {
      menuId,
      version: 2,
    });
    const draft = await owner.client.query(api.menus.getDraft, { menuId });
    expect(draft.venue.slug).toBe("nouvelle-adresse");
    expect(draft.categories[0]?.items[0]).toMatchObject({
      name: "Burrata",
      media: [{ imageStorageId: photo, imageUrl: expect.any(String) }],
    });
    expect(
      (await t.query(api.menus.getPublishedBySlug, { slug })).categories,
    ).toEqual([]);
    await owner.client.mutation(api.menus.publish, { menuId });
    expect(
      (await t.query(api.menus.getPublishedBySlug, { slug })).categories[0]
        .items[0].media[0].imageUrl,
    ).toEqual(expect.any(String));
  });

  it("duplique et déplace un plat sans perdre sa photo à la suppression de l’original", async () => {
    const { t, owner, stranger, menuId, itemIds } = await setup();
    const photo = await storeImage(t);
    await owner.client.mutation(api.menus.addItemImage, {
      itemId: itemIds[0]!,
      storageId: photo,
    });
    const copy = await owner.client.mutation(api.menus.duplicateItem, {
      itemId: itemIds[0]!,
    });
    const target = await owner.client.mutation(api.menus.addCategory, {
      menuId,
      name: "À partager",
    });
    await owner.client.mutation(api.menus.moveItem, {
      itemId: copy,
      categoryId: target,
    });
    const other = await createPublishedVenue(stranger, "Autre");
    await expect(
      owner.client.mutation(api.menus.moveItem, {
        itemId: copy,
        categoryId: other.categoryId,
      }),
    ).rejects.toThrow("Forbidden");
    await owner.client.mutation(api.menus.deleteItem, { itemId: itemIds[0]! });
    await owner.client.mutation(api.menus.publish, { menuId });
    const draft = await owner.client.query(api.menus.getDraft, { menuId });
    expect(draft.categories[1]?.items[0]).toMatchObject({
      name: "Burrata (copie)",
      media: [{ imageStorageId: photo }],
    });
    expect(await t.run((ctx) => ctx.db.system.get(photo))).not.toBeNull();
  });

  it("importe atomiquement et garde le contenu publié inchangé", async () => {
    const { t, owner, menuId, slug } = await setup();
    const row = {
      category: "plats",
      name: "Risotto",
      priceCents: 1850,
      description: "Champignons",
    };
    await expect(
      owner.client.mutation(api.menus.importItems, {
        menuId,
        rows: [row, { ...row, priceCents: -1 }],
      }),
    ).rejects.toThrow("INVALID_IMPORT");
    expect(
      (await owner.client.query(api.menus.getDraft, { menuId })).categories[0]
        ?.items,
    ).toHaveLength(2);
    await owner.client.mutation(api.menus.importItems, {
      menuId,
      rows: [row, { ...row, category: "Desserts", name: "Sorbet" }],
    });
    const draft = await owner.client.query(api.menus.getDraft, { menuId });
    expect(draft.categories).toHaveLength(2);
    expect(draft.categories[0]?.items).toHaveLength(3);
    expect(
      (await t.query(api.menus.getPublishedBySlug, { slug })).categories[0]
        .items,
    ).toHaveLength(2);
    await expect(
      owner.client.mutation(api.menus.importItems, {
        menuId,
        rows: Array.from({ length: 200 }, () => row),
      }),
    ).rejects.toThrow("ITEM_LIMIT_REACHED");
    expect(
      (await owner.client.query(api.menus.getDraft, { menuId })).categories[0]
        ?.items,
    ).toHaveLength(3);
  });
});
