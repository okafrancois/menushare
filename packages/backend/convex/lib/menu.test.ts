import { describe, expect, it } from "vitest";

import {
  ALLERGENS,
  DISH_TAGS,
  normalizeAllergens,
  normalizeOpeningHours,
  normalizeTags,
} from "./menu";

describe("normalizeAllergens", () => {
  it("deduplicates and returns keys in catalog order", () => {
    expect(normalizeAllergens(["lait", "gluten", "lait", "sesame"])).toEqual([
      "gluten",
      "lait",
      "sesame",
    ]);
  });

  it("keeps an empty list (no major allergen)", () => {
    expect(normalizeAllergens([])).toEqual([]);
  });

  it("accepts every catalog key", () => {
    const keys = ALLERGENS.map((allergen) => allergen.key);
    expect(normalizeAllergens([...keys].reverse())).toEqual(keys);
  });

  it("rejects unknown keys", () => {
    expect(() => normalizeAllergens(["gluten", "Gluten"])).toThrow(
      "INVALID_ALLERGEN",
    );
    expect(() => normalizeAllergens([""])).toThrow("INVALID_ALLERGEN");
  });
});

describe("normalizeTags", () => {
  it("deduplicates and returns keys in catalog order", () => {
    expect(normalizeTags(["signature", "vegan", "vegan"])).toEqual([
      "vegan",
      "signature",
    ]);
    expect(normalizeTags(DISH_TAGS.map((tag) => tag.key))).toHaveLength(6);
  });

  it("rejects unknown keys", () => {
    expect(() => normalizeTags(["bio"])).toThrow("INVALID_TAG");
  });
});

describe("normalizeOpeningHours", () => {
  it("sorts days and ranges and drops empty days", () => {
    expect(
      normalizeOpeningHours([
        {
          day: 4,
          ranges: [
            { open: "19:00", close: "01:30" },
            { open: "12:00", close: "14:30" },
          ],
        },
        { day: 6, ranges: [] },
        { day: 0, ranges: [{ open: "08:00", close: "23:59" }] },
      ]),
    ).toEqual([
      { day: 0, ranges: [{ open: "08:00", close: "23:59" }] },
      {
        day: 4,
        ranges: [
          { open: "12:00", close: "14:30" },
          { open: "19:00", close: "01:30" },
        ],
      },
    ]);
  });

  it("accepts an empty week (hours cleared)", () => {
    expect(normalizeOpeningHours([])).toEqual([]);
  });

  it.each([
    ["a day outside 0..6", [{ day: 7, ranges: [] }]],
    ["a negative day", [{ day: -1, ranges: [] }]],
    ["a fractional day", [{ day: 1.5, ranges: [] }]],
    [
      "a duplicated day",
      [
        { day: 2, ranges: [{ open: "12:00", close: "14:00" }] },
        { day: 2, ranges: [] },
      ],
    ],
    [
      "more than three ranges",
      [
        {
          day: 1,
          ranges: [
            { open: "07:00", close: "09:00" },
            { open: "12:00", close: "14:00" },
            { open: "16:00", close: "18:00" },
            { open: "19:00", close: "23:00" },
          ],
        },
      ],
    ],
    [
      "an hour of 24",
      [{ day: 1, ranges: [{ open: "24:00", close: "02:00" }] }],
    ],
    [
      "a missing leading zero",
      [{ day: 1, ranges: [{ open: "9:00", close: "12:00" }] }],
    ],
    [
      "minutes above 59",
      [{ day: 1, ranges: [{ open: "09:60", close: "12:00" }] }],
    ],
    [
      "an empty range",
      [{ day: 1, ranges: [{ open: "12:00", close: "12:00" }] }],
    ],
  ])("rejects %s", (_label, value) => {
    expect(() => normalizeOpeningHours(value)).toThrow("INVALID_OPENING_HOURS");
  });
});
