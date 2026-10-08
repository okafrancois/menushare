import type { MenuCategory, MenuItem } from "@/lib/menu-domain";

// Unicode-aware word boundaries: `\b` does not see "à" as a letter.
const DRINKS =
  /(^|[^\p{L}])(boissons?|vins?|bi[eè]res?|cocktails?|ap[eé]ritifs?|digestifs?|softs?|caf[eé]s?|th[eé]s?|cave|à boire|a boire|drinks?)(?=$|[^\p{L}])/iu;

/** Drinks rarely need a photo: only dish categories are nudged. */
export function expectsPhoto(category: Pick<MenuCategory, "name" | "eyebrow">) {
  return !DRINKS.test(`${category.name} ${category.eyebrow}`);
}

export function missingPhoto(
  item: Pick<MenuItem, "images">,
  category: Pick<MenuCategory, "name" | "eyebrow">,
) {
  return expectsPhoto(category) && item.images.length === 0;
}

/** Allergens are mandatory information; a photo is strongly recommended. */
export function isIncomplete(
  item: Pick<MenuItem, "images" | "allergens">,
  category: Pick<MenuCategory, "name" | "eyebrow">,
) {
  return item.allergens === undefined || missingPhoto(item, category);
}

export function completionCounts(categories: MenuCategory[]) {
  let withoutPhoto = 0;
  let withoutAllergens = 0;
  let incomplete = 0;
  for (const category of categories) {
    for (const item of category.items) {
      if (missingPhoto(item, category)) withoutPhoto++;
      if (item.allergens === undefined) withoutAllergens++;
      if (isIncomplete(item, category)) incomplete++;
    }
  }
  return { withoutPhoto, withoutAllergens, incomplete };
}
