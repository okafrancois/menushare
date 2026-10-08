"use client";

import { Copy, Plus, X } from "lucide-react";

import { Switch } from "@/components/dashboard/ui";
import type { OpeningDay } from "@/lib/menu-domain";
import { DAY_NAMES } from "@/lib/opening-hours";

const DEFAULT_RANGES = [
  { open: "12:00", close: "14:30" },
  { open: "19:00", close: "22:30" },
];
const MAX_RANGES = 3;

export function sortHours(hours: OpeningDay[]) {
  return [...hours]
    .filter((entry) => entry.ranges.length)
    .sort((a, b) => a.day - b.day);
}

export function HoursEditor({
  value,
  onChange,
}: {
  value: OpeningDay[];
  onChange: (value: OpeningDay[]) => void;
}) {
  const byDay = new Map(value.map((entry) => [entry.day, entry.ranges]));

  function setDay(day: number, ranges: OpeningDay["ranges"]) {
    const others = value.filter((entry) => entry.day !== day);
    onChange(sortHours(ranges.length ? [...others, { day, ranges }] : others));
  }

  return (
    <div className="pro-hours">
      {DAY_NAMES.map((name, day) => {
        const ranges = byDay.get(day) ?? [];
        const open = ranges.length > 0;
        return (
          <div className={`pro-hours-day ${open ? "" : "closed"}`} key={day}>
            <div className="pro-hours-head">
              <strong>{name}</strong>
              <span className="pro-hours-state">{open ? "Ouvert" : "Fermé"}</span>
              <Switch
                checked={open}
                label={`${name} ouvert`}
                onChange={(next) => setDay(day, next ? DEFAULT_RANGES : [])}
              />
            </div>
            {open ? (
              <div className="pro-hours-ranges">
                {ranges.map((range, index) => (
                  <div className="pro-range" key={index}>
                    <input
                      type="time"
                      aria-label={`${name}, plage ${index + 1}, ouverture`}
                      value={range.open}
                      onChange={(event) =>
                        setDay(
                          day,
                          ranges.map((candidate, position) =>
                            position === index
                              ? { ...candidate, open: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      type="time"
                      aria-label={`${name}, plage ${index + 1}, fermeture`}
                      value={range.close}
                      onChange={(event) =>
                        setDay(
                          day,
                          ranges.map((candidate, position) =>
                            position === index
                              ? { ...candidate, close: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="pro-icon-btn plain"
                      aria-label={`Retirer la plage ${index + 1} du ${name.toLowerCase()}`}
                      onClick={() =>
                        setDay(
                          day,
                          ranges.filter((_, position) => position !== index),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div className="pro-hours-actions">
                  {ranges.length < MAX_RANGES ? (
                    <button
                      type="button"
                      className="pro-text-btn"
                      onClick={() =>
                        setDay(day, [...ranges, { open: "18:00", close: "23:00" }])
                      }
                    >
                      <Plus size={14} /> Ajouter une plage
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="pro-text-btn"
                    onClick={() =>
                      onChange(
                        sortHours(
                          value.map((entry) => ({ ...entry, ranges: [...ranges] })),
                        ),
                      )
                    }
                  >
                    <Copy size={14} /> Copier sur les jours ouverts
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Returns an error message, or null when every range is usable. */
export function validateHours(hours: OpeningDay[]) {
  for (const entry of hours) {
    for (const range of entry.ranges) {
      if (!/^\d{2}:\d{2}$/.test(range.open) || !/^\d{2}:\d{2}$/.test(range.close))
        return `${DAY_NAMES[entry.day]} : complétez les heures.`;
      if (range.open === range.close)
        return `${DAY_NAMES[entry.day]} : l’ouverture et la fermeture sont identiques.`;
    }
  }
  return null;
}
