import type { OpeningDay } from "@/lib/menu-domain";

/** Index 0 = lundi … 6 = dimanche, as stored in `venues.openingHours`. */
export const DAY_NAMES = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;
export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const WEEK = 7 * 24 * 60;
const SOON_MINUTES = 30;

// Venues are in France: opening hours are read in Paris time.
const parisClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function parisTime(now: number) {
  const parts = Object.fromEntries(
    parisClock.formatToParts(new Date(now)).map((part) => [part.type, part.value]),
  );
  return {
    day: WEEKDAYS.indexOf(parts.weekday ?? "Mon"),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** "19:00" → "19h", "22:30" → "22h30", "09:05" → "9h05". */
export function formatTime(value: string) {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)}h${minutes && minutes !== "00" ? minutes : ""}`;
}

export function formatRanges(ranges: OpeningDay["ranges"]) {
  return ranges
    .map((range) => `${formatTime(range.open)}–${formatTime(range.close)}`)
    .join(" · ");
}

type Interval = { start: number; end: number; close: string; day: number };

function intervals(hours: OpeningDay[]): Interval[] {
  return hours.flatMap((entry) =>
    entry.ranges.map((range) => {
      const start = entry.day * 1440 + toMinutes(range.open);
      let end = entry.day * 1440 + toMinutes(range.close);
      if (end <= start) end += 1440;
      return { start, end, close: range.close, day: entry.day };
    }),
  );
}

export type OpeningStatus = {
  open: boolean;
  /** Short label for a chip, e.g. "Ouvert · jusqu’à 22h30". */
  label: string;
};

export function openingStatus(
  hours: OpeningDay[] | undefined,
  now: number,
): OpeningStatus | null {
  if (!hours?.some((entry) => entry.ranges.length)) return null;
  const { day, minutes } = parisTime(now);
  const current = day * 1440 + minutes;
  const all = intervals(hours);

  for (const interval of all) {
    for (const shift of [0, -WEEK]) {
      const start = interval.start + shift;
      const end = interval.end + shift;
      if (current >= start && current < end) {
        const closeLabel = formatTime(interval.close);
        return end - current <= SOON_MINUTES
          ? { open: true, label: `Ferme bientôt · ${closeLabel}` }
          : { open: true, label: `Ouvert · jusqu’à ${closeLabel}` };
      }
    }
  }

  let next: { at: number; interval: Interval } | null = null;
  for (const interval of all) {
    for (const shift of [0, WEEK]) {
      const at = interval.start + shift;
      if (at > current && (!next || at < next.at)) next = { at, interval };
    }
  }
  if (!next) return { open: false, label: "Fermé" };
  const openLabel = formatTime(
    `${Math.floor((next.at % 1440) / 60)}:${String(next.at % 60).padStart(2, "0")}`,
  );
  const dayOffset = Math.floor(next.at / 1440) - day;
  if (dayOffset === 0) return { open: false, label: `Fermé · ouvre à ${openLabel}` };
  if (dayOffset === 1)
    return { open: false, label: `Fermé · ouvre demain à ${openLabel}` };
  return {
    open: false,
    label: `Fermé · ouvre ${DAY_NAMES[next.interval.day]!.toLowerCase()} à ${openLabel}`,
  };
}

/** One line per weekday, starting on Monday, with "Fermé" for closed days. */
export function weekSchedule(hours: OpeningDay[] | undefined) {
  return DAY_NAMES.map((name, day) => {
    const entry = hours?.find((candidate) => candidate.day === day);
    return {
      day,
      name,
      label: entry?.ranges.length ? formatRanges(entry.ranges) : "Fermé",
    };
  });
}

/** Compact summary such as "Mar–Ven 12h–14h30 · 19h–22h30 ; Sam 19h–23h". */
export function hoursSummary(hours: OpeningDay[] | undefined) {
  if (!hours?.some((entry) => entry.ranges.length)) return "";
  const rows = weekSchedule(hours);
  const groups: { from: number; to: number; label: string }[] = [];
  for (const row of rows) {
    if (row.label === "Fermé") continue;
    const last = groups.at(-1);
    if (last && last.label === row.label && last.to === row.day - 1) {
      last.to = row.day;
    } else {
      groups.push({ from: row.day, to: row.day, label: row.label });
    }
  }
  return groups
    .map(
      (group) =>
        `${DAY_SHORT[group.from]}${group.to > group.from ? `–${DAY_SHORT[group.to]}` : ""} ${group.label}`,
    )
    .join(" ; ");
}

/** Today's closing time in Paris, used as the default end of a daily special. */
export function closingTimeToday(
  hours: OpeningDay[] | undefined,
  now: number,
): string | null {
  const { day, minutes } = parisTime(now);
  const entry = hours?.find((candidate) => candidate.day === day);
  const ranges = entry?.ranges ?? [];
  const upcoming = ranges.filter((range) => {
    const start = toMinutes(range.open);
    let end = toMinutes(range.close);
    if (end <= start) end += 1440;
    return end > minutes;
  });
  return upcoming.at(-1)?.close ?? null;
}

/**
 * Timestamp of the next occurrence of `time` ("HH:MM") in Paris after `now`,
 * at most 24 hours ahead.
 */
export function nextOccurrence(time: string, now: number) {
  const { minutes } = parisTime(now);
  let delta = toMinutes(time) - minutes;
  if (delta <= 0) delta += 1440;
  const rounded = now - (now % 60_000);
  return rounded + delta * 60_000;
}
