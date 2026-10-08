import { describe, expect, it } from "vitest";

import { contrastRatio, readableInk, safeAccent } from "@/lib/color";
import { createDemoState } from "@/lib/menu-domain";
import { completionCounts, expectsPhoto, isIncomplete } from "@/lib/menu-quality";

describe("complétude de la carte", () => {
  it("n’attend pas de photo pour les boissons", () => {
    expect(expectsPhoto({ name: "À boire", eyebrow: "" })).toBe(false);
    expect(expectsPhoto({ name: "Vins rouges", eyebrow: "" })).toBe(false);
    expect(expectsPhoto({ name: "Desserts", eyebrow: "Café gourmand" })).toBe(
      false,
    );
    expect(expectsPhoto({ name: "Antipasti", eyebrow: "Pour commencer" })).toBe(
      true,
    );
  });

  it("compte les plats sans photo et sans allergènes de la démo", () => {
    expect(completionCounts(createDemoState().categories)).toEqual({
      withoutPhoto: 4,
      withoutAllergens: 2,
      incomplete: 4,
    });
  });

  it("considère les allergènes comme obligatoires", () => {
    const category = { name: "À boire", eyebrow: "" };
    expect(isIncomplete({ images: [], allergens: [] }, category)).toBe(false);
    expect(isIncomplete({ images: [], allergens: undefined }, category)).toBe(
      true,
    );
  });
});

describe("couleur de l’établissement", () => {
  it("choisit une encre lisible sur la couleur", () => {
    expect(readableInk("#76263c")).toBe("#ffffff");
    expect(readableInk("#f5d76e")).toBe("#1f1a17");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("retombe sur la couleur par défaut si elle est invalide", () => {
    expect(safeAccent("rouge")).toBe("#76263c");
    expect(safeAccent("#123456")).toBe("#123456");
  });
});
