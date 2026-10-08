import { describe, expect, it } from "vitest";
import { createDemoState } from "./menu-domain";
import { menuCsv, parseMenuCsv } from "./menu-import";
import { csvCell } from "./download";

describe("CSV de la carte", () => {
  it("lit les accents, les virgules décimales et les descriptions sur plusieurs lignes", () => {
    const rows = parseMenuCsv(
      '\uFEFFCatégorie;Nom;Prix;Description\r\nEntrées;"Salade; fraîche";12,50;"Tomates\n""du jardin"""',
    );
    expect(rows).toEqual([
      {
        category: "Entrées",
        name: "Salade; fraîche",
        priceCents: 1250,
        description: 'Tomates\n"du jardin"',
      },
    ]);
  });
  it("accepte un séparateur virgule et une description facultative", () => {
    expect(
      parseMenuCsv("nom,prix,categorie\nCafé,2.50,Boissons")[0],
    ).toMatchObject({ name: "Café", priceCents: 250, description: "" });
  });
  it("exporte un fichier réimportable sans perdre les prix et les descriptions", () => {
    const state = createDemoState();
    const rows = parseMenuCsv(menuCsv(state));
    expect(rows).toEqual(
      state.categories.flatMap((category) =>
        category.items.map((item) => ({
          category: category.name,
          name: item.name,
          priceCents: item.priceCents,
          description: item.description,
        })),
      ),
    );
  });
  it("rejette les prix invalides et les fichiers incomplets avant l’import", () => {
    expect(() => parseMenuCsv("categorie;nom;prix\nPlats;Soupe;-2")).toThrow(
      "Ligne 2",
    );
    expect(() => parseMenuCsv("categorie;nom;prix\nPlats;;2")).toThrow(
      "Ligne 2",
    );
    expect(() => parseMenuCsv('categorie;nom;prix\nPlats;"Soupe;2')).toThrow(
      "guillemet",
    );
    expect(() => parseMenuCsv("categorie;nom;prix")).toThrow("entre 1 et 500");
    expect(() => parseMenuCsv("plat;montant\nSoupe;2")).toThrow(
      "Colonnes attendues",
    );
  });
  it("neutralise les formules de tableur", () => {
    expect(csvCell('=HYPERLINK("https://example.com")')).toBe(
      '"\'=HYPERLINK(""https://example.com"")"',
    );
  });
});
