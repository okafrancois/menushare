import { describe, expect, it } from "vitest";

import type { OpeningDay } from "@/lib/menu-domain";
import {
  closingTimeToday,
  formatTime,
  hoursSummary,
  nextOccurrence,
  openingStatus,
  parisTime,
  weekSchedule,
} from "@/lib/opening-hours";

// Thursday 8 October 2026, Paris is UTC+2 (summer time).
const at = (hhmm: string, day = 8) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return Date.UTC(2026, 9, day, hours! - 2, minutes!);
};

const TRATTORIA: OpeningDay[] = [
  { day: 1, ranges: [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "22:30" }] },
  { day: 2, ranges: [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "22:30" }] },
  { day: 3, ranges: [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "22:30" }] },
  { day: 4, ranges: [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "23:00" }] },
  { day: 5, ranges: [{ open: "19:00", close: "01:30" }] },
];

describe("horaires d’ouverture", () => {
  it("lit l’heure de Paris, lundi = 0", () => {
    expect(parisTime(at("13:05"))).toEqual({ day: 3, minutes: 13 * 60 + 5 });
  });

  it("formate les heures à la française", () => {
    expect(formatTime("19:00")).toBe("19h");
    expect(formatTime("22:30")).toBe("22h30");
    expect(formatTime("09:05")).toBe("9h05");
  });

  it("indique l’heure de fermeture pendant le service", () => {
    expect(openingStatus(TRATTORIA, at("13:00"))).toEqual({
      open: true,
      label: "Ouvert · jusqu’à 14h30",
    });
    expect(openingStatus(TRATTORIA, at("22:10"))).toEqual({
      open: true,
      label: "Ferme bientôt · 22h30",
    });
  });

  it("indique la prochaine ouverture quand c’est fermé", () => {
    expect(openingStatus(TRATTORIA, at("16:00"))?.label).toBe(
      "Fermé · ouvre à 19h",
    );
    expect(openingStatus(TRATTORIA, at("23:00"))?.label).toBe(
      "Fermé · ouvre demain à 12h",
    );
    // Sunday 11 October, after the Saturday night service.
    expect(openingStatus(TRATTORIA, at("12:00", 11))?.label).toBe(
      "Fermé · ouvre mardi à 12h",
    );
  });

  it("gère une plage qui se termine après minuit", () => {
    // Sunday 11 October at 00:45: Saturday's service is still running.
    expect(openingStatus(TRATTORIA, at("00:45", 11))).toEqual({
      open: true,
      label: "Ouvert · jusqu’à 1h30",
    });
  });

  it("ne dit rien sans horaires", () => {
    expect(openingStatus([], at("12:00"))).toBeNull();
    expect(openingStatus(undefined, at("12:00"))).toBeNull();
  });

  it("résume la semaine et liste chaque jour", () => {
    expect(hoursSummary(TRATTORIA)).toBe(
      "Mar–Jeu 12h–14h30 · 19h–22h30 ; Ven 12h–14h30 · 19h–23h ; Sam 19h–1h30",
    );
    const week = weekSchedule(TRATTORIA);
    expect(week[0]).toEqual({ day: 0, name: "Lundi", label: "Fermé" });
    expect(week[5]!.label).toBe("19h–1h30");
  });

  it("propose la fermeture du jour comme fin de suggestion", () => {
    expect(closingTimeToday(TRATTORIA, at("13:00"))).toBe("22:30");
    expect(closingTimeToday(TRATTORIA, at("23:30"))).toBeNull();
    // Sunday 00:30: Saturday's service runs until 1:30.
    expect(closingTimeToday(TRATTORIA, at("00:30", 11))).toBe("01:30");
  });

  it("calcule la prochaine occurrence d’une heure", () => {
    const now = at("13:00");
    expect(nextOccurrence("22:30", now)).toBe(at("22:30"));
    expect(nextOccurrence("11:00", now)).toBe(at("11:00", 9));
  });
});
