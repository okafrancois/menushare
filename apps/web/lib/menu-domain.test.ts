import { describe, expect, it } from "vitest";

import {
  createDemoState,
  createItem,
  createVenueState,
  formatPrice,
  hydrateMenuState,
  move,
  parsePriceToCents,
  priceToInput,
  publishMenu,
  reorderById,
  slugify,
  validateSlug,
} from "@/lib/menu-domain";

describe("slug métier", () => {
  it("normalise les accents, espaces et caractères spéciaux", () => {
    expect(slugify("  Chez Léon & Fils ! ")).toBe("chez-leon-fils");
  });

  it("rejette les slugs trop courts et réservés", () => {
    expect(validateSlug("ab")).toContain("3 caractères");
    expect(validateSlug("dashboard")).toContain("réservée");
    expect(validateSlug("chez-leon")).toBeNull();
  });
});

describe("plats et médias", () => {
  it("convertit correctement les prix français", () => {
    expect(parsePriceToCents("12,50")).toBe(1250);
    expect(formatPrice(1250)).toContain("12,50");
  });

  it("crée un plat avec une vidéo YouTube normalisée", () => {
    const item = createItem({
      id: "1",
      name: "Pasta",
      price: "18",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    });
    expect(item.video).toEqual({
      provider: "youtube",
      externalId: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
    expect(item.images).toEqual([]);
    expect(item.available).toBe(true);
  });

  it("conserve les contenus éditoriaux de la fiche plat", () => {
    const item = createItem({
      id: "burrata",
      name: "Burrata",
      description: "La description courte.",
      details: "Une longue description de la préparation.",
      price: "14",
      ingredients: ["Burrata des Pouilles", " Basilic frais "],
      pairingName: "Verre de Vermentino",
      pairingPrice: "7",
      reviewRating: 4.9,
      reviewCount: 148,
      reviewQuote: "Comme en Italie.",
      reviewAuthor: "Chiara F.",
    });
    expect(item.ingredients).toEqual(["Burrata des Pouilles", "Basilic frais"]);
    expect(item.pairingPriceCents).toBe(700);
    expect(item.reviewRating).toBe(4.9);
    expect(item.details).toContain("préparation");
  });

  it("refuse un prix vide au lieu de l’enregistrer à 0 €", () => {
    expect(() => parsePriceToCents("  ")).toThrow("INVALID_PRICE");
    expect(parsePriceToCents("0")).toBe(0);
    expect(priceToInput(1250)).toBe("12,50");
    expect(priceToInput(1400)).toBe("14");
    expect(priceToInput(undefined)).toBe("");
  });

  it("garde allergènes et badges, « non renseigné » par défaut", () => {
    const documented = createItem({
      id: "1",
      name: "Pasta",
      price: "18",
      allergens: ["gluten"],
      tags: ["vegetarien"],
    });
    expect(documented.allergens).toEqual(["gluten"]);
    expect(documented.tags).toEqual(["vegetarien"]);
    const bare = createItem({ id: "2", name: "Pain", price: "2" });
    expect(bare.allergens).toBeUndefined();
    expect(bare.tags).toEqual([]);
  });

  it("rejette un prix ou un hébergeur vidéo invalide", () => {
    expect(() => parsePriceToCents("gratuit? ")).toThrow("INVALID_PRICE");
    expect(() =>
      createItem({
        id: "1",
        name: "Pasta",
        price: "18",
        videoUrl: "https://example.com/video",
      }),
    ).toThrow("UNSUPPORTED_VIDEO_PROVIDER");
  });
});

describe("ordre et publication", () => {
  it("réordonne sans muter la liste source", () => {
    const source = ["a", "b", "c"];
    expect(move(source, 2, 0)).toEqual(["c", "a", "b"]);
    expect(source).toEqual(["a", "b", "c"]);
    expect(move(source, 0, -1)).toBe(source);
  });

  it("applique un ordre explicite et ignore un ordre incomplet", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(reorderById(items, ["c", "a", "b"]).map((i) => i.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(reorderById(items, ["c", "a"])).toBe(items);
    expect(reorderById(items, ["c", "a", "z"])).toBe(items);
  });

  it("publie un snapshot indépendant et incrémente sa version", () => {
    const draft = createDemoState(100);
    const changed = {
      ...draft,
      venue: { ...draft.venue, name: "Nouveau nom" },
      changedAt: 200,
    };
    const published = publishMenu(changed, 300);
    changed.venue.name = "Mutation tardive";
    expect(published.published?.venue.name).toBe("Nouveau nom");
    expect(published.published?.version).toBe(2);
    expect(published.published?.publishedAt).toBe(300);
  });
});

describe("état initial et hydratation", () => {
  it("crée un établissement vide validé", () => {
    const state = createVenueState({
      id: "v1",
      name: "Café Été",
      slug: "cafe-ete",
      kind: "Café",
      city: "Lyon",
      now: 10,
    });
    expect(state.venue.slug).toBe("cafe-ete");
    expect(state.categories).toEqual([]);
    expect(state.published).toBeUndefined();
  });

  it("retombe sur la démo si le stockage est corrompu", () => {
    expect(hydrateMenuState({ nope: true }).venue.slug).toBe("nonna-lydie");
  });

  it("complète les anciennes fiches sauvegardées avec les nouveaux champs", () => {
    const legacy = createDemoState();
    const item = legacy.categories[0].items[0] as Partial<
      (typeof legacy.categories)[number]["items"][number]
    >;
    delete item.details;
    delete item.ingredients;
    const hydrated = hydrateMenuState(legacy);
    expect(hydrated.categories[0].items[0].details).toBe("");
    expect(hydrated.categories[0].items[0].ingredients).toEqual([]);
  });

  it("complète une sauvegarde d’avant les ruptures et les badges", () => {
    const legacy = JSON.parse(JSON.stringify(createDemoState())) as Record<
      string,
      unknown
    > & { categories: { items: Record<string, unknown>[] }[] };
    delete legacy.live;
    delete legacy.categories[0]!.items[0]!.tags;
    const hydrated = hydrateMenuState(legacy);
    expect(hydrated.live).toEqual({
      soldOutIds: [],
      autoRestock: true,
      special: undefined,
    });
    expect(hydrated.categories[0]!.items[0]!.tags).toEqual([]);
  });

  it("démarre la démo avec une rupture et une suggestion du jour", () => {
    const demo = createDemoState();
    expect(demo.live.soldOutIds).toEqual(["arancini"]);
    expect(demo.live.special?.name).toBe("Risotto ai Porcini");
    expect(demo.published?.version).toBe(1);
  });
});
