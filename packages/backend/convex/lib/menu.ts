// Shared menu vocabulary (allergens, dish tags, opening hours, daily special
// limits). Pure code: imported by Convex functions and by the web app.

/** The 14 major allergens of EU regulation 1169/2011, in display order. */
export const ALLERGENS = [
  { key: "gluten", label: "Gluten" },
  { key: "crustaces", label: "Crustacés" },
  { key: "oeufs", label: "Œufs" },
  { key: "poisson", label: "Poisson" },
  { key: "arachides", label: "Arachides" },
  { key: "soja", label: "Soja" },
  { key: "lait", label: "Lait" },
  { key: "fruits-a-coque", label: "Fruits à coque" },
  { key: "celeri", label: "Céleri" },
  { key: "moutarde", label: "Moutarde" },
  { key: "sesame", label: "Sésame" },
  { key: "sulfites", label: "Sulfites" },
  { key: "lupin", label: "Lupin" },
  { key: "mollusques", label: "Mollusques" },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]["key"];

export const DISH_TAGS = [
  { key: "vegetarien", label: "Végétarien" },
  { key: "vegan", label: "Vegan" },
  { key: "epice", label: "Épicé" },
  { key: "fait-maison", label: "Fait maison" },
  { key: "nouveau", label: "Nouveau" },
  { key: "signature", label: "Signature du chef" },
] as const;

export type DishTagKey = (typeof DISH_TAGS)[number]["key"];

/** Longest a daily special can stay online. */
export const SPECIAL_MAX_DURATION_MS = 36 * 60 * 60 * 1000;
export const SPECIAL_NAME_MAX = 80;

const MAX_RANGES_PER_DAY = 3;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeKeys<Key extends string>(
  values: readonly string[],
  catalog: readonly { key: Key }[],
  error: string,
): Key[] {
  const rank = new Map<string, number>(
    catalog.map((entry, index) => [entry.key, index]),
  );
  const keys = new Set<Key>();
  for (const value of values) {
    if (!rank.has(value)) throw new Error(error);
    keys.add(value as Key);
  }
  return [...keys].sort((a, b) => rank.get(a)! - rank.get(b)!);
}

/**
 * Validates allergen keys, removes duplicates and returns them in catalog
 * order. An empty list means "no major allergen" (distinct from absent).
 */
export function normalizeAllergens(values: readonly string[]): AllergenKey[] {
  return normalizeKeys(values, ALLERGENS, "INVALID_ALLERGEN");
}

/** Validates dish tag keys, removes duplicates, returns them in catalog order. */
export function normalizeTags(values: readonly string[]): DishTagKey[] {
  return normalizeKeys(values, DISH_TAGS, "INVALID_TAG");
}

/**
 * "HH:MM" bounds. A range whose `close` is before `open` ends after midnight
 * (e.g. 19:00 → 01:00); `open === close` is rejected as ambiguous.
 */
export type OpeningRange = { open: string; close: string };
/** `day`: 0 = Monday … 6 = Sunday. */
export type OpeningDay = { day: number; ranges: OpeningRange[] };

/**
 * Validates weekly opening hours, drops days without ranges and sorts days
 * and ranges chronologically. An empty result means "no hours given".
 */
export function normalizeOpeningHours(
  value: readonly OpeningDay[],
): OpeningDay[] {
  const fail = (): never => {
    throw new Error("INVALID_OPENING_HOURS");
  };
  const seen = new Set<number>();
  const days: OpeningDay[] = [];
  for (const entry of value) {
    if (!Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6) fail();
    if (seen.has(entry.day)) fail();
    seen.add(entry.day);
    if (entry.ranges.length > MAX_RANGES_PER_DAY) fail();
    const ranges = entry.ranges.map(({ open, close }) => {
      if (!TIME.test(open) || !TIME.test(close) || open === close) fail();
      return { open, close };
    });
    if (ranges.length === 0) continue;
    ranges.sort((a, b) => a.open.localeCompare(b.open));
    days.push({ day: entry.day, ranges });
  }
  return days.sort((a, b) => a.day - b.day);
}
