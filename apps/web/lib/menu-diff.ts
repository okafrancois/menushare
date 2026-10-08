import {
  formatPrice,
  type MenuCategory,
  type MenuItem,
  type Venue,
} from "@/lib/menu-domain";

export type MenuChange = {
  id: string;
  title: string;
  detail: string;
};

type MenuContent = { venue: Venue; categories: MenuCategory[] };

const INFO_FIELDS: [keyof Venue, string][] = [
  ["name", "nom"],
  ["kind", "type"],
  ["city", "ville"],
  ["tagline", "accroche"],
  ["description", "présentation"],
  ["address", "adresse"],
  ["phone", "téléphone"],
  ["hours", "horaires (texte)"],
  ["openingHours", "horaires d’ouverture"],
];

const LOOK_FIELDS: [keyof Venue, string][] = [
  ["accentColor", "couleur"],
  ["logoDataUrl", "logo"],
  ["coverImageDataUrl", "couverture"],
  ["coverVideo", "vidéo de couverture"],
];

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function listFields(before: Venue, after: Venue, fields: [keyof Venue, string][]) {
  return fields
    .filter(([field]) => !same(before[field], after[field]))
    .map(([, label]) => label);
}

function itemDifferences(before: MenuItem, after: MenuItem) {
  const details: string[] = [];
  if (before.name !== after.name) details.push(`nom : ${before.name} → ${after.name}`);
  if (before.priceCents !== after.priceCents)
    details.push(
      `prix ${formatPrice(before.priceCents)} → ${formatPrice(after.priceCents)}`,
    );
  if (before.available !== after.available)
    details.push(after.available ? "affiché sur la carte" : "masqué de la carte");
  if (before.description !== after.description) details.push("description");
  if (before.details !== after.details) details.push("fiche détaillée");
  const beforeImages = new Set(before.images.map((image) => image.id));
  const afterImages = new Set(after.images.map((image) => image.id));
  const added = [...afterImages].filter((id) => !beforeImages.has(id)).length;
  const removed = [...beforeImages].filter((id) => !afterImages.has(id)).length;
  if (added && removed) details.push("photos remplacées");
  else if (added) details.push(added > 1 ? `${added} nouvelles photos` : "nouvelle photo");
  else if (removed) details.push(removed > 1 ? `${removed} photos retirées` : "photo retirée");
  else if (!same(before.images.map((i) => i.id), after.images.map((i) => i.id)))
    details.push("ordre des photos");
  if (!same(before.video?.embedUrl, after.video?.embedUrl)) details.push("vidéo");
  if (!same(before.allergens, after.allergens)) details.push("allergènes");
  if (!same(before.tags, after.tags)) details.push("régime et badges");
  if (!same(before.ingredients, after.ingredients)) details.push("ingrédients");
  if (
    before.pairingName !== after.pairingName ||
    before.pairingPriceCents !== after.pairingPriceCents
  )
    details.push("accord");
  if (
    before.reviewRating !== after.reviewRating ||
    before.reviewCount !== after.reviewCount ||
    before.reviewQuote !== after.reviewQuote ||
    before.reviewAuthor !== after.reviewAuthor
  )
    details.push("avis");
  return details;
}

function itemIndex(categories: MenuCategory[]) {
  const index = new Map<string, { item: MenuItem; category: MenuCategory }>();
  for (const category of categories)
    for (const item of category.items) index.set(item.id, { item, category });
  return index;
}

function commonOrder(ids: string[], others: Set<string>) {
  return ids.filter((id) => others.has(id));
}

/**
 * Human-readable list of what publishing would change on the live menu.
 * Live service data (sold-out dishes, suggestion of the day) and the menu
 * address (changed immediately, the old one redirects) never appear here.
 */
export function diffMenu(
  published: MenuContent | undefined,
  draft: MenuContent,
): MenuChange[] {
  if (!published) {
    const count = draft.categories.reduce((n, c) => n + c.items.length, 0);
    return [
      {
        id: "first-publication",
        title: "Première publication",
        detail: `${count} plat${count > 1 ? "s" : ""} dans ${draft.categories.length} catégorie${draft.categories.length > 1 ? "s" : ""}`,
      },
    ];
  }

  const changes: MenuChange[] = [];
  const before = published.venue;
  const after = draft.venue;

  const info = listFields(before, after, INFO_FIELDS);
  if (info.length)
    changes.push({
      id: "venue-info",
      title: "Informations de l’établissement",
      detail: capitalize(info.join(", ")),
    });
  const look = listFields(before, after, LOOK_FIELDS);
  if (look.length)
    changes.push({
      id: "venue-look",
      title: "Apparence",
      detail: capitalize(look.join(", ")),
    });

  const beforeCategories = new Map(published.categories.map((c) => [c.id, c]));
  const afterCategories = new Map(draft.categories.map((c) => [c.id, c]));

  for (const category of draft.categories) {
    const previous = beforeCategories.get(category.id);
    if (!previous) {
      changes.push({
        id: `category-added-${category.id}`,
        title: category.name,
        detail: "Nouvelle catégorie",
      });
      continue;
    }
    const details: string[] = [];
    if (previous.name !== category.name)
      details.push(`renommée : ${previous.name} → ${category.name}`);
    if (previous.eyebrow !== category.eyebrow) details.push("sous-titre");
    const previousIds = new Set(previous.items.map((item) => item.id));
    const currentIds = new Set(category.items.map((item) => item.id));
    if (
      !same(
        commonOrder(
          previous.items.map((item) => item.id),
          currentIds,
        ),
        commonOrder(
          category.items.map((item) => item.id),
          previousIds,
        ),
      )
    )
      details.push("ordre des plats");
    if (details.length)
      changes.push({
        id: `category-${category.id}`,
        title: category.name,
        detail: capitalize(details.join(" · ")),
      });
  }
  for (const category of published.categories) {
    if (!afterCategories.has(category.id))
      changes.push({
        id: `category-removed-${category.id}`,
        title: category.name,
        detail: "Catégorie supprimée",
      });
  }
  const categoryOrderBefore = commonOrder(
    published.categories.map((c) => c.id),
    new Set(afterCategories.keys()),
  );
  const categoryOrderAfter = commonOrder(
    draft.categories.map((c) => c.id),
    new Set(beforeCategories.keys()),
  );
  if (!same(categoryOrderBefore, categoryOrderAfter))
    changes.push({
      id: "category-order",
      title: "Ordre des catégories",
      detail: categoryOrderAfter
        .map((id) => afterCategories.get(id)!.name)
        .join(" · "),
    });

  const beforeItems = itemIndex(published.categories);
  const afterItems = itemIndex(draft.categories);
  for (const [id, { item, category }] of afterItems) {
    const previous = beforeItems.get(id);
    if (!previous) {
      changes.push({
        id: `item-added-${id}`,
        title: item.name,
        detail: `Nouveau plat · ${category.name} · ${formatPrice(item.priceCents)}`,
      });
      continue;
    }
    const details = itemDifferences(previous.item, item);
    if (previous.category.id !== category.id)
      details.unshift(`déplacé dans ${category.name}`);
    if (details.length)
      changes.push({
        id: `item-${id}`,
        title: item.name,
        detail: capitalize(details.join(" · ")),
      });
  }
  for (const [id, { item, category }] of beforeItems) {
    if (afterItems.has(id) || !afterCategories.has(category.id)) continue;
    changes.push({
      id: `item-removed-${id}`,
      title: item.name,
      detail: "Plat supprimé",
    });
  }
  return changes;
}
