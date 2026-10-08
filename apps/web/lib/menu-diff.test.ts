import { describe, expect, it } from "vitest";

import { diffMenu } from "@/lib/menu-diff";
import { createDemoState, createItem, type MenuState } from "@/lib/menu-domain";

function content(state: MenuState) {
  return { venue: state.venue, categories: state.categories };
}

/** Intl inserts narrow no-break spaces before "€". */
function plain(value: string) {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("diffMenu", () => {
  it("annonce une première publication avec le nombre de plats", () => {
    const state = createDemoState();
    expect(diffMenu(undefined, content(state))).toEqual([
      {
        id: "first-publication",
        title: "Première publication",
        detail: "15 plats dans 4 catégories",
      },
    ]);
  });

  it("ne voit aucun changement entre un brouillon et sa version publiée", () => {
    const state = createDemoState();
    expect(diffMenu(state.published, content(state))).toEqual([]);
  });

  it("décrit un changement de prix et de photo sur un plat", () => {
    const state = createDemoState();
    const draft = clone(content(state));
    const burrata = draft.categories[0]!.items[0]!;
    burrata.priceCents = 1500;
    burrata.images.push({ id: "new", dataUrl: "/x.jpg", alt: "x" });
    const changes = diffMenu(state.published, draft);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.title).toBe("Burrata Pugliese");
    expect(plain(changes[0]!.detail)).toBe("Prix 14 € → 15 € · nouvelle photo");
  });

  it("repère plats ajoutés, supprimés, masqués et allergènes modifiés", () => {
    const state = createDemoState();
    const draft = clone(content(state));
    const antipasti = draft.categories[0]!;
    antipasti.items = antipasti.items.filter((item) => item.id !== "vitello");
    antipasti.items.push(createItem({ id: "olive", name: "Olives", price: "4" }));
    antipasti.items[0]!.available = false;
    antipasti.items[1]!.allergens = ["lait"];
    const changes = diffMenu(state.published, draft);
    expect(changes.map((change) => [change.title, plain(change.detail)])).toEqual([
      ["Burrata Pugliese", "Masqué de la carte"],
      ["Caprese di Bufala", "Allergènes"],
      ["Olives", "Nouveau plat · Antipasti · 4 €"],
      ["Vitello Tonnato", "Plat supprimé"],
    ]);
  });

  it("signale l’ordre des catégories et des plats", () => {
    const state = createDemoState();
    const draft = clone(content(state));
    draft.categories.reverse();
    draft.categories[0]!.items.reverse();
    const changes = diffMenu(state.published, draft);
    expect(changes.map((change) => change.id)).toEqual([
      "category-bevande",
      "category-order",
    ]);
    expect(changes[0]!.detail).toBe("Ordre des plats");
  });

  it("regroupe infos et apparence, sans l’adresse déjà effective", () => {
    const state = createDemoState();
    const draft = clone(content(state));
    draft.venue.name = "Nonna";
    draft.venue.openingHours = [];
    draft.venue.accentColor = "#000000";
    draft.venue.slug = "nonna";
    expect(diffMenu(state.published, draft)).toEqual([
      {
        id: "venue-info",
        title: "Informations de l’établissement",
        detail: "Nom, horaires d’ouverture",
      },
      { id: "venue-look", title: "Apparence", detail: "Couleur" },
    ]);
  });

  it("ignore les données de service en direct", () => {
    const state = createDemoState();
    const live = {
      ...state,
      live: { ...state.live, soldOutIds: ["burrata", "tiramisu"] },
    };
    expect(diffMenu(state.published, content(live))).toEqual([]);
  });
});
