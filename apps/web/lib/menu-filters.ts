import { ALLERGENS, DISH_TAGS } from "@repo/backend/menu";

import type { AllergenKey, MenuItem } from "@/lib/menu-domain";

/** "Sans gluten" is simply the gluten allergen being avoided. */
export type DietFilter = {
  vegetarian: boolean;
  avoid: AllergenKey[];
};

export const EMPTY_FILTER: DietFilter = { vegetarian: false, avoid: [] };

const ALLERGEN_LABELS = new Map<string, string>(
  ALLERGENS.map((allergen) => [allergen.key, allergen.label]),
);
const TAG_LABELS = new Map<string, string>(
  DISH_TAGS.map((tag) => [tag.key, tag.label]),
);

export function toggleAvoid(filter: DietFilter, key: AllergenKey): DietFilter {
  const avoid = filter.avoid.includes(key)
    ? filter.avoid.filter((candidate) => candidate !== key)
    : [...filter.avoid, key];
  return {
    ...filter,
    avoid: ALLERGENS.map((allergen) => allergen.key).filter((candidate) =>
      avoid.includes(candidate),
    ),
  };
}

export function allergenLabel(key: string) {
  return ALLERGEN_LABELS.get(key) ?? key;
}

export function tagLabel(key: string) {
  return TAG_LABELS.get(key) ?? key;
}

export function isFilterActive(filter: DietFilter) {
  return filter.vegetarian || filter.avoid.length > 0;
}

export function isVegetarian(item: Pick<MenuItem, "tags">) {
  return item.tags.includes("vegetarien") || item.tags.includes("vegan");
}

/** Gluten-free only when allergens are documented and gluten is absent. */
export function isGlutenFree(item: Pick<MenuItem, "allergens">) {
  return item.allergens !== undefined && !item.allergens.includes("gluten");
}

export function allergenConflicts(
  item: Pick<MenuItem, "allergens">,
  avoid: readonly AllergenKey[],
) {
  return (item.allergens ?? []).filter((allergen) => avoid.includes(allergen));
}

/**
 * A dish is hidden when it does not match a diet, contains an avoided
 * allergen, or has undocumented allergens while some are being avoided (it
 * cannot be guaranteed safe).
 */
export function isHiddenByFilter(
  item: Pick<MenuItem, "tags" | "allergens">,
  filter: DietFilter,
) {
  if (filter.vegetarian && !isVegetarian(item)) return true;
  if (filter.avoid.length) {
    if (item.allergens === undefined) return true;
    if (allergenConflicts(item, filter.avoid).length) return true;
  }
  return false;
}

export function filterSummary(filter: DietFilter) {
  return [
    filter.vegetarian ? "végétarien" : "",
    ...filter.avoid.map((key) => `sans ${allergenLabel(key).toLowerCase()}`),
  ]
    .filter(Boolean)
    .join(", ");
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Accent-insensitive search on the name, texts, ingredients and tags. */
export function matchesSearch(
  item: Pick<
    MenuItem,
    "name" | "description" | "details" | "ingredients" | "tags"
  >,
  query: string,
  categoryName = "",
) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const haystack = normalizeSearch(
    [
      item.name,
      item.description,
      item.details,
      categoryName,
      ...item.ingredients,
      ...item.tags.map(tagLabel),
    ].join(" "),
  );
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}
