import type {
  AllergenKey,
  DishTagKey,
  OpeningDay,
} from "@repo/backend/menu";
import { normalizeExternalVideoUrl } from "@repo/backend/video";

export type { AllergenKey, DishTagKey, OpeningDay };

export type MenuImage = {
  id: string;
  dataUrl: string;
  alt: string;
};

export type ExternalVideo = ReturnType<typeof normalizeExternalVideoUrl>;

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  details: string;
  priceCents: number;
  /** Shown on the published menu. Hiding a dish is a draft change. */
  available: boolean;
  images: MenuImage[];
  video?: ExternalVideo;
  ingredients: string[];
  /** `undefined` = not documented yet, `[]` = none of the 14 major allergens. */
  allergens?: AllergenKey[];
  tags: DishTagKey[];
  pairingName: string;
  pairingPriceCents?: number;
  reviewRating?: number;
  reviewCount?: number;
  reviewQuote: string;
  reviewAuthor: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  eyebrow: string;
  items: MenuItem[];
};

export type Venue = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  city: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  /** Free-text hours, kept for venues that never filled `openingHours`. */
  hours: string;
  openingHours?: OpeningDay[];
  accentColor: string;
  logoDataUrl?: string;
  coverImageDataUrl?: string;
  coverVideo?: ExternalVideo;
  tableCount?: number;
};

export type MenuSnapshot = {
  venue: Venue;
  categories: MenuCategory[];
  publishedAt: number;
  version: number;
};

/** Suggestion of the day: live, outside the draft/publish cycle. */
export type DailySpecial = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl?: string;
  /** Storage id of the photo (remote mode), needed to keep it on update. */
  imageStorageId?: string;
  endsAt: number;
};

/** Service data applied to the public menu immediately, without publishing. */
export type LiveService = {
  soldOutIds: string[];
  autoRestock: boolean;
  special?: DailySpecial;
};

export type MenuState = {
  venue: Venue;
  categories: MenuCategory[];
  published?: MenuSnapshot;
  changedAt: number;
  live: LiveService;
};

export const STORAGE_KEY = "menushare.demo.v1";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const DEMO_VENUE_ID = "venue-demo";
export const DEMO_POPULAR_IDS = ["burrata", "tagliatelle", "tiramisu", "vongole"];
export const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "menu",
  "onboarding",
  "sign-in",
  "sign-up",
  "support",
]);

export function emptyLiveService(): LiveService {
  return { soldOutIds: [], autoRestock: true };
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validateSlug(value: string) {
  const slug = slugify(value);
  if (slug.length < 3) return "Le slug doit contenir au moins 3 caractères.";
  if (RESERVED_SLUGS.has(slug)) return "Cette adresse est réservée.";
  return null;
}

export function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

/** Price typed by an owner ("12,50"); an empty value is rejected. */
export function parsePriceToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("INVALID_PRICE");
  const amount = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("INVALID_PRICE");
  return Math.round(amount * 100);
}

/** Cents back to the French input format ("12,5" → "12,50"). */
export function priceToInput(priceCents: number | undefined) {
  if (priceCents === undefined) return "";
  return (priceCents / 100)
    .toFixed(priceCents % 100 === 0 ? 0 : 2)
    .replace(".", ",");
}

export function videoToUrl(video: ExternalVideo) {
  return video.provider === "youtube"
    ? `https://youtu.be/${video.externalId}`
    : `https://vimeo.com/${video.externalId}`;
}

export function createItem(input: {
  id: string;
  name: string;
  description?: string;
  details?: string;
  price: string;
  videoUrl?: string;
  ingredients?: string[];
  allergens?: AllergenKey[];
  tags?: DishTagKey[];
  pairingName?: string;
  pairingPrice?: string;
  reviewRating?: number;
  reviewCount?: number;
  reviewQuote?: string;
  reviewAuthor?: string;
  images?: MenuImage[];
}): MenuItem {
  return {
    id: input.id,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    details: input.details?.trim() ?? "",
    priceCents: parsePriceToCents(input.price),
    available: true,
    images: input.images ?? [],
    video: input.videoUrl?.trim()
      ? normalizeExternalVideoUrl(input.videoUrl)
      : undefined,
    ingredients:
      input.ingredients?.map((value) => value.trim()).filter(Boolean) ?? [],
    allergens: input.allergens,
    tags: input.tags ?? [],
    pairingName: input.pairingName?.trim() ?? "",
    pairingPriceCents: input.pairingPrice?.trim()
      ? parsePriceToCents(input.pairingPrice)
      : undefined,
    reviewRating: input.reviewRating,
    reviewCount: input.reviewCount,
    reviewQuote: input.reviewQuote?.trim() ?? "",
    reviewAuthor: input.reviewAuthor?.trim() ?? "",
  };
}

export function move<T>(items: T[], from: number, to: number) {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length)
    return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Applies an explicit order of ids; unknown or missing ids keep the list. */
export function reorderById<T extends { id: string }>(items: T[], ids: string[]) {
  if (
    ids.length !== items.length ||
    items.some((item) => !ids.includes(item.id))
  )
    return items;
  return ids.map((id) => items.find((item) => item.id === id)!);
}

function cloneSnapshotSource(state: MenuState) {
  return JSON.parse(
    JSON.stringify({ venue: state.venue, categories: state.categories }),
  ) as Pick<MenuSnapshot, "venue" | "categories">;
}

export function publishMenu(state: MenuState, now = Date.now()): MenuState {
  const source = cloneSnapshotSource(state);
  return {
    ...state,
    published: {
      ...source,
      publishedAt: now,
      version: (state.published?.version ?? 0) + 1,
    },
    changedAt: now,
  };
}

export function createVenueState(input: {
  id: string;
  name: string;
  slug: string;
  kind: string;
  city: string;
  now?: number;
}): MenuState {
  const error = validateSlug(input.slug);
  if (error) throw new Error(error);
  const now = input.now ?? Date.now();
  return {
    venue: {
      id: input.id,
      name: input.name.trim(),
      slug: slugify(input.slug),
      kind: input.kind.trim() || "Restaurant",
      city: input.city.trim(),
      tagline: "Une cuisine à découvrir.",
      description:
        "Présentez ici votre établissement, votre cuisine et votre histoire.",
      address: "",
      phone: "",
      hours: "",
      openingHours: [],
      accentColor: "#76263c",
    },
    categories: [],
    changedAt: now,
    live: emptyLiveService(),
  };
}

export function createEmptyState(now = Date.now()): MenuState {
  return {
    venue: {
      id: "",
      slug: "votre-menu",
      name: "Votre établissement",
      kind: "Restaurant",
      city: "",
      tagline: "Une cuisine à découvrir.",
      description: "",
      address: "",
      phone: "",
      hours: "",
      openingHours: [],
      accentColor: "#76263c",
    },
    categories: [],
    changedAt: now,
    live: emptyLiveService(),
  };
}

const LUNCH = { open: "12:00", close: "14:30" };
const DINNER = { open: "19:00", close: "22:30" };
const LATE_DINNER = { open: "19:00", close: "23:00" };

function demoImage(id: string, alt: string): MenuImage[] {
  return [{ id: `${id}-cover`, dataUrl: `/demo/${id}.jpg`, alt }];
}

export function createDemoState(now = 1_786_000_000_000): MenuState {
  const state: MenuState = {
    venue: {
      id: DEMO_VENUE_ID,
      slug: "nonna-lydie",
      name: "Nonna Lydie",
      kind: "Trattoria",
      city: "Bordeaux",
      tagline: "Pâtes fraîches maison, sauces mijotées, produits d’Italie.",
      description:
        "Chez Nonna Lydie, on cuisine comme à la maison : pâtes fraîches roulées le matin, sauces mijotées lentement et produits venus directement d’Italie.",
      address: "12 rue des Remparts, 33000 Bordeaux",
      phone: "05 56 00 00 00",
      hours: "Fermé le dimanche et le lundi.",
      openingHours: [
        { day: 1, ranges: [LUNCH, DINNER] },
        { day: 2, ranges: [LUNCH, DINNER] },
        { day: 3, ranges: [LUNCH, DINNER] },
        { day: 4, ranges: [LUNCH, LATE_DINNER] },
        { day: 5, ranges: [LUNCH, LATE_DINNER] },
      ],
      accentColor: "#76263c",
      coverImageDataUrl: "/demo/cover.jpg",
      coverVideo: normalizeExternalVideoUrl("https://youtu.be/dQw4w9WgXcQ"),
      tableCount: 12,
    },
    categories: [
      {
        id: "antipasti",
        name: "Antipasti",
        eyebrow: "Pour commencer",
        items: [
          createItem({
            id: "burrata",
            name: "Burrata Pugliese",
            description:
              "Burrata 125 g des Pouilles, tomates confites au basilic.",
            details:
              "Une burrata crémeuse des Pouilles, servie avec des tomates cerises marinées, du basilic frais et un filet d’huile d’olive extra vierge.",
            price: "14",
            ingredients: [
              "Burrata des Pouilles",
              "Tomates cerises",
              "Basilic frais",
              "Huile d’olive extra vierge",
              "Fleur de sel",
              "Poivre du moulin",
            ],
            allergens: ["lait"],
            tags: ["vegetarien"],
            pairingName: "Verre de Vermentino di Sardegna",
            pairingPrice: "7",
            reviewRating: 4.9,
            reviewCount: 148,
            reviewQuote:
              "Une burrata d’une fraîcheur incroyable, comme en Italie.",
            reviewAuthor: "Chiara F.",
            images: demoImage(
              "burrata",
              "Burrata Pugliese, tomates marinées et basilic",
            ),
          }),
          createItem({
            id: "caprese",
            name: "Caprese di Bufala",
            description:
              "Mozzarella di bufala, tomates anciennes, pesto de basilic.",
            price: "12",
            ingredients: [
              "Mozzarella di bufala",
              "Tomates anciennes",
              "Pesto",
              "Pignons de pin",
            ],
            allergens: ["lait", "fruits-a-coque"],
            tags: ["vegetarien", "nouveau"],
            images: demoImage("caprese", "Caprese di bufala et tomates"),
          }),
          createItem({
            id: "vitello",
            name: "Vitello Tonnato",
            description:
              "Veau rosé en fines tranches, crème de thon et câpres.",
            price: "13",
            allergens: ["poisson", "oeufs", "moutarde"],
          }),
          createItem({
            id: "arancini",
            name: "Arancini al Ragù",
            description:
              "Boulettes de riz croustillantes, cœur ragù et mozzarella.",
            price: "9",
            tags: ["fait-maison"],
          }),
        ],
      },
      {
        id: "primi",
        name: "Primi & Secondi",
        eyebrow: "Le cœur du repas",
        items: [
          createItem({
            id: "tagliatelle",
            name: "Tagliatelle al Tartufo",
            description:
              "Pâtes fraîches du jour, crème de truffe, parmesan 24 mois.",
            details:
              "Nos tagliatelle sont roulées chaque matin, puis nappées d’une crème à la truffe noire et d’un parmesan affiné 24 mois.",
            price: "24",
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ingredients: [
              "Pâtes fraîches aux œufs",
              "Truffe noire",
              "Crème",
              "Parmesan 24 mois",
            ],
            allergens: ["gluten", "oeufs", "lait"],
            tags: ["vegetarien", "signature"],
            pairingName: "Verre de Chianti Classico",
            pairingPrice: "8",
            images: demoImage("tagliatelle", "Tagliatelle à la truffe"),
          }),
          createItem({
            id: "vongole",
            name: "Spaghetti alle Vongole",
            description: "Palourdes, ail, piment doux, persil plat, vin blanc.",
            price: "22",
            allergens: ["gluten", "mollusques", "sulfites"],
            tags: ["epice"],
            images: demoImage("vongole", "Spaghetti aux palourdes"),
          }),
          createItem({
            id: "lasagne",
            name: "Lasagne della Nonna",
            description:
              "Ragù de bœuf mijoté 6 h, béchamel et mozzarella gratinée.",
            price: "19",
            allergens: ["gluten", "oeufs", "lait", "celeri"],
            tags: ["fait-maison"],
            images: demoImage("lasagne", "Lasagne gratinées"),
          }),
          createItem({
            id: "polpette",
            name: "Polpette al Sugo",
            description: "Boulettes de bœuf et veau, sauce tomate, focaccia.",
            price: "17",
            allergens: ["gluten", "oeufs", "lait"],
            images: demoImage("polpette", "Boulettes à la sauce tomate"),
          }),
          createItem({
            id: "osso-buco",
            name: "Osso Buco alla Milanese",
            description: "Jarret de veau confit, gremolata et risotto safrané.",
            price: "27",
          }),
        ],
      },
      {
        id: "dolci",
        name: "Dolci",
        eyebrow: "La note finale",
        items: [
          createItem({
            id: "tiramisu",
            name: "Tiramisù della Casa",
            description:
              "Mascarpone monté minute, biscuits imbibés d’espresso.",
            price: "9",
            allergens: ["gluten", "oeufs", "lait"],
            tags: ["vegetarien", "fait-maison"],
            images: demoImage("tiramisu", "Tiramisù"),
          }),
          createItem({
            id: "panna-cotta",
            name: "Panna Cotta ai Frutti Rossi",
            description: "Crème vanille de Madagascar, coulis de fruits rouges.",
            price: "8",
            allergens: ["lait"],
            tags: ["vegetarien"],
            images: demoImage("pannacotta", "Panna cotta aux fruits rouges"),
          }),
          createItem({
            id: "cannoli",
            name: "Cannoli Siciliani",
            description:
              "Coques croustillantes, ricotta de brebis, pistache de Bronte.",
            price: "8",
            allergens: ["gluten", "lait", "fruits-a-coque"],
            tags: ["vegetarien"],
          }),
        ],
      },
      {
        id: "bevande",
        name: "À boire",
        eyebrow: "Vins & boissons",
        items: [
          createItem({
            id: "vermentino",
            name: "Vermentino di Sardegna",
            description: "Blanc · verre 12 cl",
            price: "7",
            allergens: ["sulfites"],
            tags: ["vegan"],
          }),
          createItem({
            id: "chianti",
            name: "Chianti Classico DOCG",
            description: "Rouge · verre 12 cl",
            price: "8",
            allergens: ["sulfites"],
            tags: ["vegan"],
          }),
          createItem({
            id: "limonata",
            name: "Limonata maison",
            description: "Citrons de Sicile, menthe fraîche.",
            price: "5",
            allergens: [],
            tags: ["vegan", "fait-maison"],
          }),
        ],
      },
    ],
    changedAt: now,
    live: {
      soldOutIds: ["arancini"],
      autoRestock: true,
      special: {
        id: "special-demo",
        name: "Risotto ai Porcini",
        description: "Cèpes poêlés, parmesan 24 mois, beurre noisette.",
        priceCents: 2300,
        // Far in the future: the demo special never expires on its own.
        endsAt: 4_102_444_800_000,
      },
    },
  };
  return publishMenu(state, now);
}

function withItemDefaults(item: MenuItem): MenuItem {
  return {
    ...item,
    details: item.details ?? "",
    ingredients: item.ingredients ?? [],
    tags: item.tags ?? [],
    pairingName: item.pairingName ?? "",
    reviewQuote: item.reviewQuote ?? "",
    reviewAuthor: item.reviewAuthor ?? "",
  };
}

function withCategoryDefaults(category: MenuCategory): MenuCategory {
  return { ...category, items: category.items.map(withItemDefaults) };
}

export function hydrateMenuState(value: unknown): MenuState {
  if (!value || typeof value !== "object") return createDemoState();
  const candidate = value as Partial<MenuState>;
  if (!candidate.venue?.slug || !Array.isArray(candidate.categories))
    return createDemoState();
  const live = candidate.live;
  return {
    ...(candidate as MenuState),
    venue: { ...candidate.venue, openingHours: candidate.venue.openingHours ?? [] },
    categories: candidate.categories.map(withCategoryDefaults),
    published: candidate.published
      ? {
          ...candidate.published,
          venue: {
            ...candidate.published.venue,
            openingHours: candidate.published.venue.openingHours ?? [],
          },
          categories: candidate.published.categories.map(withCategoryDefaults),
        }
      : undefined,
    live: {
      soldOutIds: Array.isArray(live?.soldOutIds) ? live.soldOutIds : [],
      autoRestock: live?.autoRestock ?? true,
      special: live?.special,
    },
  };
}
