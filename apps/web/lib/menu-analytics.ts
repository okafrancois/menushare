export type VisitSource =
  | { source: "direct"; table?: undefined }
  | { source: "qr"; table?: undefined }
  | { source: "table"; table: number };

export const VISITOR_STORAGE_KEY = "menushare.visitor.v1";
// The CNIL exemption for audience measurement caps tracker lifetime at 13 months.
export const VISITOR_LIFETIME_MS = 395 * 24 * 60 * 60 * 1000;
export const VIDEO_COMPLETION_RATIO = 0.9;

/** QR code URLs carry `?src=qr` (whole venue) or `?t=<n>` (one table). */
export function menuQrUrl(menuUrl: string, table?: number) {
  return table ? `${menuUrl}?t=${table}` : `${menuUrl}?src=qr`;
}

/**
 * Reads how the visitor arrived, and the address to show once the tracking
 * parameters are removed so a shared link is not counted as a scan.
 */
export function readVisitSource(search: string): VisitSource & {
  cleanedSearch: string;
} {
  const params = new URLSearchParams(search);
  const rawTable = params.get("t");
  const scanned = params.get("src") === "qr";
  params.delete("t");
  params.delete("src");
  const remaining = params.toString();
  const cleanedSearch = remaining ? `?${remaining}` : "";

  if (rawTable !== null && /^\d{1,3}$/.test(rawTable) && Number(rawTable) > 0) {
    return { source: "table", table: Number(rawTable), cleanedSearch };
  }
  if (scanned || rawTable !== null) return { source: "qr", cleanedSearch };
  return { source: "direct", cleanedSearch };
}

export function visitorIdFrom(
  stored: string | null,
  now: number,
  createId: () => string,
): { id: string; stored?: string } {
  try {
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      "createdAt" in parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.createdAt === "number" &&
      now - parsed.createdAt < VISITOR_LIFETIME_MS
    ) {
      return { id: parsed.id };
    }
  } catch {
    // A corrupted value is replaced below.
  }
  const id = createId();
  return { id, stored: JSON.stringify({ id, createdAt: now }) };
}

export function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Embed URL with the JavaScript player API enabled, so playback is observable. */
export function playerApiUrl(
  video: { provider: "youtube" | "vimeo"; embedUrl: string },
  origin: string,
) {
  if (video.provider !== "youtube") return video.embedUrl;
  const url = new URL(video.embedUrl);
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("origin", origin);
  return url.toString();
}

// Must match ANALYTICS_TIME_ZONE in @repo/backend: statistics days are Paris days.
const statsDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function statsDay(timestamp: number) {
  return statsDayFormatter.format(new Date(timestamp));
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest
    ? `${minutes} min ${String(rest).padStart(2, "0")}`
    : `${minutes} min`;
}

export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}
