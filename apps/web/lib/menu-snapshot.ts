import type {
  AllergenKey,
  DailySpecial,
  DishTagKey,
  ExternalVideo,
  MenuCategory,
  MenuItem,
  MenuSnapshot,
  OpeningDay,
  Venue,
} from "@/lib/menu-domain";

type RawMedia = {
  _id: string;
  kind: "image" | "externalVideo";
  imageUrl?: string | null;
  alt?: string;
  provider?: "youtube" | "vimeo";
  externalId?: string;
  embedUrl?: string;
};

type RawItem = {
  _id: string;
  name: string;
  description?: string;
  details?: string;
  priceCents: number;
  active: boolean;
  ingredients?: string[];
  allergens?: string[];
  tags?: string[];
  pairingName?: string;
  pairingPriceCents?: number;
  reviewRating?: number;
  reviewCount?: number;
  reviewQuote?: string;
  reviewAuthor?: string;
  media: RawMedia[];
};

type RawVenue = {
  _id: string;
  slug: string;
  name: string;
  kind: string;
  city?: string;
  tagline?: string;
  description?: string;
  address?: string;
  phone?: string;
  hours?: string;
  openingHours?: OpeningDay[];
  accentColor?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  coverVideoProvider?: "youtube" | "vimeo";
  coverVideoExternalId?: string;
  coverVideoEmbedUrl?: string;
  tableCount?: number;
  status?: "draft" | "published" | "archived";
};

/** Shape stored in `menuSnapshots.data` and returned by the draft query. */
export type RawMenuPayload = {
  venue: RawVenue;
  menu: { version: number; publishedAt?: number; updatedAt?: number };
  categories: Array<{
    _id: string;
    name: string;
    eyebrow?: string;
    items: RawItem[];
  }>;
};

export function toVenue(raw: RawVenue): Venue {
  return {
    id: raw._id,
    slug: raw.slug,
    name: raw.name,
    kind: raw.kind || "Restaurant",
    city: raw.city ?? "",
    tagline: raw.tagline ?? "",
    description: raw.description ?? "",
    address: raw.address ?? "",
    phone: raw.phone ?? "",
    hours: raw.hours ?? "",
    openingHours: raw.openingHours ?? [],
    accentColor: raw.accentColor ?? "#76263c",
    logoDataUrl: raw.logoUrl ?? undefined,
    coverImageDataUrl: raw.coverImageUrl ?? undefined,
    coverVideo:
      raw.coverVideoProvider &&
      raw.coverVideoExternalId &&
      raw.coverVideoEmbedUrl
        ? {
            provider: raw.coverVideoProvider,
            externalId: raw.coverVideoExternalId,
            embedUrl: raw.coverVideoEmbedUrl,
          }
        : undefined,
    tableCount: raw.tableCount,
    status: raw.status,
  };
}

function toVideo(media: RawMedia[]): ExternalVideo | undefined {
  const video = media.find(
    (asset) =>
      asset.kind === "externalVideo" &&
      asset.provider &&
      asset.externalId &&
      asset.embedUrl,
  );
  return video?.provider && video.externalId && video.embedUrl
    ? {
        provider: video.provider,
        externalId: video.externalId,
        embedUrl: video.embedUrl,
      }
    : undefined;
}

export function toMenuItem(raw: RawItem): MenuItem {
  return {
    id: raw._id,
    name: raw.name,
    description: raw.description ?? "",
    details: raw.details ?? "",
    priceCents: raw.priceCents,
    available: raw.active,
    images: raw.media
      .filter((asset) => asset.kind === "image" && asset.imageUrl)
      .map((asset) => ({
        id: asset._id,
        dataUrl: asset.imageUrl!,
        alt: asset.alt ?? raw.name,
      })),
    video: toVideo(raw.media),
    ingredients: raw.ingredients ?? [],
    allergens: raw.allergens as AllergenKey[] | undefined,
    tags: (raw.tags ?? []) as DishTagKey[],
    pairingName: raw.pairingName ?? "",
    pairingPriceCents: raw.pairingPriceCents,
    reviewRating: raw.reviewRating,
    reviewCount: raw.reviewCount,
    reviewQuote: raw.reviewQuote ?? "",
    reviewAuthor: raw.reviewAuthor ?? "",
  };
}

export function toCategories(
  raw: RawMenuPayload["categories"],
): MenuCategory[] {
  return raw.map((category) => ({
    id: category._id,
    name: category.name,
    eyebrow: category.eyebrow ?? "",
    items: category.items.map(toMenuItem),
  }));
}

function isPayload(value: unknown): value is RawMenuPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RawMenuPayload>;
  return Boolean(
    candidate.venue?._id &&
    candidate.venue.slug &&
    candidate.venue.name &&
    candidate.menu &&
    Array.isArray(candidate.categories),
  );
}

/** Published (or draft) payload from Convex → domain snapshot. */
export function toMenuSnapshot(value: unknown): MenuSnapshot | null {
  if (!isPayload(value)) return null;
  return {
    venue: toVenue(value.venue),
    categories: toCategories(value.categories),
    publishedAt: value.menu.publishedAt ?? 0,
    version: value.menu.version,
  };
}

type RawSpecial = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string | null;
  imageStorageId?: string | null;
  endsAt: number;
};

export function toDailySpecial(
  raw: RawSpecial | null | undefined,
): DailySpecial | undefined {
  if (!raw) return undefined;
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description ?? "",
    priceCents: raw.priceCents,
    imageUrl: raw.imageUrl ?? undefined,
    imageStorageId: raw.imageStorageId ?? undefined,
    endsAt: raw.endsAt,
  };
}

/** Live service data (`menus.getLiveService`): sold-out dishes and special. */
export function toLiveData(value: unknown): {
  soldOutIds: string[];
  special?: DailySpecial;
} {
  if (!value || typeof value !== "object") return { soldOutIds: [] };
  const candidate = value as {
    soldOutItemIds?: unknown;
    special?: RawSpecial | null;
  };
  return {
    soldOutIds: Array.isArray(candidate.soldOutItemIds)
      ? candidate.soldOutItemIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    special: toDailySpecial(candidate.special),
  };
}
