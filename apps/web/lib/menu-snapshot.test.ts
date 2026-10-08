import { describe, expect, it } from "vitest";

import { toLiveData, toMenuSnapshot } from "@/lib/menu-snapshot";

const payload = {
  venue: {
    _id: "v1",
    slug: "chez-test",
    name: "Chez Test",
    kind: "Bistrot",
    openingHours: [{ day: 0, ranges: [{ open: "12:00", close: "14:00" }] }],
    logoUrl: "https://cdn/logo",
    coverVideoProvider: "youtube",
    coverVideoExternalId: "abc",
    coverVideoEmbedUrl: "https://www.youtube-nocookie.com/embed/abc",
  },
  menu: { version: 3, publishedAt: 1000 },
  categories: [
    {
      _id: "c1",
      name: "Plats",
      items: [
        {
          _id: "i1",
          name: "Burrata",
          priceCents: 1400,
          active: true,
          allergens: ["lait"],
          tags: ["vegetarien"],
          media: [
            { _id: "m1", kind: "image", imageUrl: "https://cdn/1", alt: "b" },
            { _id: "m2", kind: "image", imageUrl: null },
            {
              _id: "m3",
              kind: "externalVideo",
              provider: "vimeo",
              externalId: "42",
              embedUrl: "https://player.vimeo.com/video/42",
            },
          ],
        },
        { _id: "i2", name: "Pain", priceCents: 0, active: false, media: [] },
      ],
    },
  ],
};

describe("données publiées Convex → domaine", () => {
  it("convertit l’établissement, les plats, médias, allergènes et badges", () => {
    const snapshot = toMenuSnapshot(payload)!;
    expect(snapshot.version).toBe(3);
    expect(snapshot.venue).toMatchObject({
      id: "v1",
      city: "",
      accentColor: "#76263c",
      logoDataUrl: "https://cdn/logo",
      coverVideo: { provider: "youtube", externalId: "abc" },
      openingHours: payload.venue.openingHours,
    });
    const [burrata, pain] = snapshot.categories[0]!.items;
    expect(burrata).toMatchObject({
      id: "i1",
      available: true,
      allergens: ["lait"],
      tags: ["vegetarien"],
      images: [{ id: "m1", dataUrl: "https://cdn/1", alt: "b" }],
      video: { provider: "vimeo", externalId: "42" },
    });
    expect(pain).toMatchObject({ available: false, tags: [] });
    expect(pain!.allergens).toBeUndefined();
  });

  it("refuse une réponse incomplète", () => {
    expect(toMenuSnapshot(null)).toBeNull();
    expect(toMenuSnapshot({ venue: { _id: "v" } })).toBeNull();
  });

  it("lit les ruptures et la suggestion du jour en direct", () => {
    expect(
      toLiveData({
        soldOutItemIds: ["i1", 3],
        special: {
          id: "s1",
          name: "Risotto",
          priceCents: 2300,
          imageUrl: null,
          endsAt: 5,
        },
      }),
    ).toEqual({
      soldOutIds: ["i1"],
      special: {
        id: "s1",
        name: "Risotto",
        description: "",
        priceCents: 2300,
        imageUrl: undefined,
        imageStorageId: undefined,
        endsAt: 5,
      },
    });
    expect(toLiveData(null)).toEqual({ soldOutIds: [] });
  });
});
