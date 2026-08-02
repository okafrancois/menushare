import { describe, expect, it } from "vitest";

import { buildPublicMenuSeo } from "./site-metadata";

describe("buildPublicMenuSeo", () => {
  it("uses the published venue identity for the browser title", () => {
    expect(
      buildPublicMenuSeo("chez-antoine", {
        venue: {
          name: "Chez Antoine",
          tagline: "Cuisine du marché",
          coverImageUrl: "https://images.example/cover.jpg",
        },
      }),
    ).toEqual({
      title: "Chez Antoine — La carte",
      description: "Cuisine du marché",
      imageUrl: "https://images.example/cover.jpg",
      isAvailable: true,
    });
  });

  it("keeps the built-in demo identifiable without a backend", () => {
    const metadata = buildPublicMenuSeo("nonna-lydie", null);
    expect(metadata.title).toBe("Nonna Lydie — La carte");
    expect(metadata.isAvailable).toBe(true);
  });

  it("prevents an unknown unpublished menu from looking valid", () => {
    expect(buildPublicMenuSeo("inconnu", null)).toMatchObject({
      title: "Menu indisponible",
      isAvailable: false,
    });
  });
});
