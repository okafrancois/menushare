import { describe, expect, it } from "vitest";

import {
  allergenConflicts,
  EMPTY_FILTER,
  filterSummary,
  isGlutenFree,
  isHiddenByFilter,
  matchesSearch,
  toggleAvoid,
} from "@/lib/menu-filters";
import { createItem } from "@/lib/menu-domain";

const burrata = createItem({
  id: "burrata",
  name: "Burrata Pugliese",
  description: "Tomates confites au basilic",
  price: "14",
  ingredients: ["Burrata des Pouilles"],
  allergens: ["lait"],
  tags: ["vegetarien", "fait-maison"],
});
const vongole = createItem({
  id: "vongole",
  name: "Spaghetti alle Vongole",
  price: "22",
  allergens: ["gluten", "mollusques"],
});
const undocumented = createItem({ id: "osso", name: "Osso Buco", price: "27" });

describe("filtres de la carte", () => {
  it("ne masque rien sans filtre", () => {
    for (const item of [burrata, vongole, undocumented])
      expect(isHiddenByFilter(item, EMPTY_FILTER)).toBe(false);
  });

  it("garde les plats végétariens et vegan", () => {
    const filter = { ...EMPTY_FILTER, vegetarian: true };
    expect(isHiddenByFilter(burrata, filter)).toBe(false);
    expect(isHiddenByFilter(vongole, filter)).toBe(true);
  });

  it("masque les plats contenant un allergène évité, ou non documentés", () => {
    const filter = toggleAvoid(EMPTY_FILTER, "lait");
    expect(isHiddenByFilter(burrata, filter)).toBe(true);
    expect(isHiddenByFilter(vongole, filter)).toBe(false);
    expect(isHiddenByFilter(undocumented, filter)).toBe(true);
    expect(allergenConflicts(burrata, filter.avoid)).toEqual(["lait"]);
  });

  it("garde l’ordre réglementaire des allergènes et sait les retirer", () => {
    let filter = toggleAvoid(EMPTY_FILTER, "mollusques");
    filter = toggleAvoid(filter, "gluten");
    expect(filter.avoid).toEqual(["gluten", "mollusques"]);
    expect(toggleAvoid(filter, "gluten").avoid).toEqual(["mollusques"]);
    expect(filterSummary({ vegetarian: true, avoid: ["gluten"] })).toBe(
      "végétarien, sans gluten",
    );
  });

  it("considère sans gluten uniquement un plat documenté", () => {
    expect(isGlutenFree(burrata)).toBe(true);
    expect(isGlutenFree(vongole)).toBe(false);
    expect(isGlutenFree(undocumented)).toBe(false);
  });

  it("cherche sans accents dans le nom, les textes, ingrédients et badges", () => {
    expect(matchesSearch(burrata, "pouilles")).toBe(true);
    expect(matchesSearch(burrata, "BASILIC")).toBe(true);
    expect(matchesSearch(burrata, "fait maison")).toBe(true);
    expect(matchesSearch(burrata, "vegetarien")).toBe(true);
    expect(matchesSearch(vongole, "spaghetti vongole")).toBe(true);
    expect(matchesSearch(vongole, "truffe")).toBe(false);
    expect(matchesSearch(vongole, "primi", "Primi & Secondi")).toBe(true);
  });
});
