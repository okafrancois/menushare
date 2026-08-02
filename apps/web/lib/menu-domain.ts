import { normalizeExternalVideoUrl } from "@repo/backend/video";

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
  priceCents: number;
  available: boolean;
  images: MenuImage[];
  video?: ExternalVideo;
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
  hours: string;
  accentColor: string;
  logoDataUrl?: string;
  coverImageDataUrl?: string;
  coverVideo?: ExternalVideo;
};

export type MenuSnapshot = {
  venue: Venue;
  categories: MenuCategory[];
  publishedAt: number;
  version: number;
};

export type MenuState = {
  venue: Venue;
  categories: MenuCategory[];
  published?: MenuSnapshot;
  changedAt: number;
};

export const STORAGE_KEY = "menushare.demo.v1";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "onboarding",
  "sign-in",
  "sign-up",
  "support",
]);

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

export function parsePriceToCents(value: string) {
  const amount = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("INVALID_PRICE");
  return Math.round(amount * 100);
}

export function createItem(input: {
  id: string;
  name: string;
  description?: string;
  price: string;
  videoUrl?: string;
}): MenuItem {
  return {
    id: input.id,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    priceCents: parsePriceToCents(input.price),
    available: true,
    images: [],
    video: input.videoUrl?.trim()
      ? normalizeExternalVideoUrl(input.videoUrl)
      : undefined,
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
      accentColor: "#76263c",
    },
    categories: [],
    changedAt: now,
  };
}

export function createDemoState(now = 1_786_000_000_000): MenuState {
  const state: MenuState = {
    venue: {
      id: "venue-demo",
      slug: "nonna-lydie",
      name: "Nonna Lydie",
      kind: "Trattoria",
      city: "Bordeaux",
      tagline: "Pâtes fraîches maison, sauces mijotées, produits d’Italie.",
      description:
        "Chez Nonna Lydie, on cuisine comme à la maison : pâtes fraîches roulées le matin, sauces mijotées lentement et produits venus directement d’Italie.",
      address: "12 rue des Remparts, Bordeaux",
      phone: "05 56 00 00 00",
      hours: "Mardi — Samedi · 12h—14h30 & 19h—22h30",
      accentColor: "#76263c",
      coverVideo: normalizeExternalVideoUrl("https://youtu.be/dQw4w9WgXcQ"),
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
            price: "14",
          }),
          createItem({
            id: "vitello",
            name: "Vitello Tonnato",
            description:
              "Veau rosé en fines tranches, crème de thon et câpres.",
            price: "13",
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
            price: "24",
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          }),
          createItem({
            id: "lasagne",
            name: "Lasagne della Nonna",
            description:
              "Ragù de bœuf mijoté 6 h, béchamel et mozzarella gratinée.",
            price: "19",
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
          }),
          createItem({
            id: "cannoli",
            name: "Cannoli Siciliani",
            description:
              "Coques croustillantes, ricotta de brebis, pistache de Bronte.",
            price: "8",
          }),
        ],
      },
    ],
    changedAt: now,
  };
  return publishMenu(state, now);
}

export function hydrateMenuState(value: unknown): MenuState {
  if (!value || typeof value !== "object") return createDemoState();
  const candidate = value as Partial<MenuState>;
  if (!candidate.venue?.slug || !Array.isArray(candidate.categories))
    return createDemoState();
  return candidate as MenuState;
}
