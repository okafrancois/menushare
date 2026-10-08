"use client";

import { api } from "@repo/backend/api";
import type { Id } from "@repo/backend/data-model";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  Camera,
  Link2,
  QrCode,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHead } from "@/components/dashboard/ui";
import { formatDuration, formatRate, statsDay } from "@/lib/menu-analytics";
import type { MenuCategory, MenuItem } from "@/lib/menu-domain";
import { expectsPhoto } from "@/lib/menu-quality";
import { useMenuStore } from "@/lib/menu-store";

const PERIODS = [
  { days: 7, label: "7 j", long: "7 jours" },
  { days: 30, label: "30 j", long: "30 jours" },
  { days: 90, label: "90 j", long: "90 jours" },
] as const;

type Stats = FunctionReturnType<typeof api.analytics.getStats>;
type Totals = Stats["totals"];

const numberFormat = new Intl.NumberFormat("fr-FR");
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shortDay = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDay(day: string, format = dayFormat) {
  return format.format(new Date(`${day}T00:00:00Z`));
}

export default function StatsPage() {
  const { state, remote } = useMenuStore();
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(7);

  return (
    <>
      <PageHead
        eyebrow="Mesure anonyme"
        title="Statistiques"
        actions={
          <div className="pro-seg" role="group" aria-label="Période">
            {PERIODS.map((period) => (
              <button
                key={period.days}
                type="button"
                aria-label={period.long}
                aria-pressed={period.days === days}
                onClick={() => setDays(period.days)}
              >
                {period.label}
              </button>
            ))}
          </div>
        }
      />
      {remote && state.venue.id ? (
        <RemoteStats venueId={state.venue.id as Id<"venues">} days={days} />
      ) : (
        <section className="pro-card pro-empty">
          <span className="pro-tile">
            <ShieldCheck size={22} />
          </span>
          <h2>Aucune statistique en mode démo.</h2>
          <p>
            Les visites sont mesurées dès que votre menu est publié depuis un
            compte MenuShare : scans, plats consultés, temps de lecture et
            performance de chaque table.
          </p>
        </section>
      )}
    </>
  );
}

function RemoteStats({ venueId, days }: { venueId: Id<"venues">; days: number }) {
  // The query must not read the clock: the browser supplies today and
  // refreshes it after midnight.
  const [today, setToday] = useState(() => statsDay(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(statsDay(Date.now())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const stats = useQuery(api.analytics.getStats, { venueId, today, days });
  if (stats === undefined)
    return <p className="pro-muted">Chargement des statistiques…</p>;
  return <StatsReport stats={stats} />;
}

function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  if (previous === 0) return current > 0 ? { up: true, label: "nouveau" } : null;
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < 0.005) return { up: true, label: "stable" };
  return {
    up: ratio > 0,
    label: `${ratio > 0 ? "+" : "−"}${Math.round(Math.abs(ratio) * 100)} %`,
  };
}

function Kpi({
  label,
  value,
  current,
  previous,
}: {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
}) {
  const change = delta(current, previous);
  return (
    <div className="pro-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {change ? (
        <em className={change.up ? "up" : "down"}>
          {change.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {change.label}
          <span className="sr-only"> par rapport à la période précédente</span>
        </em>
      ) : (
        <em className="flat">—</em>
      )}
    </div>
  );
}

function StatsReport({ stats }: { stats: Stats }) {
  const { state } = useMenuStore();
  const { totals, previousTotals: previous } = stats as Stats & {
    previousTotals: Totals;
  };
  const items = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const category of state.categories)
      for (const item of category.items) map.set(item.id, item);
    return map;
  }, [state.categories]);

  return (
    <div className="pro-stack">
      <div className="pro-kpis two">
        <Kpi
          label="Scans du QR"
          value={numberFormat.format(totals.scans)}
          current={totals.scans}
          previous={previous.scans}
        />
        <Kpi
          label="Visiteurs uniques"
          value={numberFormat.format(totals.uniqueVisitors)}
          current={totals.uniqueVisitors}
          previous={previous.uniqueVisitors}
        />
        <Kpi
          label="Temps moyen"
          value={formatDuration(totals.averageDurationMs)}
          current={totals.averageDurationMs}
          previous={previous.averageDurationMs}
        />
        <Kpi
          label="Plats consultés"
          value={numberFormat.format(totals.itemOpens)}
          current={totals.itemOpens}
          previous={previous.itemOpens}
        />
      </div>
      <DailyChart daily={stats.daily} />
      <PhotoInsight dishes={stats.dishes} categories={state.categories} />
      <TopDishes dishes={stats.dishes} items={items} />
      <TableHeatmap tables={stats.tables} tableCount={stats.tableCount} days={stats.period.days} />
      <Sources totals={totals} tables={stats.tables} />
      <Videos dishes={stats.dishes} coverVideo={stats.coverVideo} totals={totals} />
      <p className="pro-footnote">
        <ShieldCheck size={15} /> Aucun cookie publicitaire ni adresse IP. Vos
        propres visites, quand vous êtes connecté, ne sont pas comptées.
      </p>
    </div>
  );
}

function DailyChart({ daily }: { daily: Stats["daily"] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((day) => day.visits));
  const top = Math.max(10, Math.ceil(max / 10) * 10);
  const total = daily.reduce((sum, day) => sum + day.visits, 0);
  const point = selected === null ? null : daily[selected];
  return (
    <section className="pro-card" aria-labelledby="daily-title">
      <div className="pro-card-head">
        <div>
          <h2 id="daily-title">Visites par jour</h2>
          <p>
            {point
              ? `${formatDay(point.day)} : ${point.visits} visite${point.visits > 1 ? "s" : ""}, dont ${point.scans} scan${point.scans > 1 ? "s" : ""}`
              : "Touchez une barre pour le détail."}
          </p>
        </div>
      </div>
      {total ? (
        <>
          <div
            className="pro-bars"
            role="img"
            aria-label={`${total} visites sur la période, maximum ${max} en une journée`}
          >
            <span className="pro-gridline" style={{ bottom: "100%" }}>
              {top}
            </span>
            <span className="pro-gridline" style={{ bottom: "50%" }}>
              {top / 2}
            </span>
            {daily.map((day, index) => (
              <button
                key={day.day}
                type="button"
                className={`pro-bar ${selected === null || selected === index ? "" : "dim"}`}
                aria-label={`${formatDay(day.day)} : ${day.visits} visites`}
                aria-pressed={selected === index}
                onClick={() => setSelected(selected === index ? null : index)}
              >
                <i style={{ height: `${(day.visits / top) * 100}%` }} />
              </button>
            ))}
          </div>
          <div className="pro-axis">
            <span>{formatDay(daily[0]!.day, shortDay)}</span>
            <span>{formatDay(daily.at(-1)!.day, shortDay)}</span>
          </div>
        </>
      ) : (
        <p className="pro-muted">
          Aucune visite sur cette période.{" "}
          <Link href="/dashboard/share">Imprimez vos QR codes</Link> pour
          commencer.
        </p>
      )}
    </section>
  );
}

function dishName(name: string | null) {
  return name ?? "Plat supprimé";
}

function PhotoInsight({
  dishes,
  categories,
}: {
  dishes: Stats["dishes"];
  categories: MenuCategory[];
}) {
  const opens = new Map(dishes.map((dish) => [dish.itemId, dish.opens]));
  const groups = { with: [] as number[], without: [] as number[] };
  for (const category of categories) {
    if (!expectsPhoto(category)) continue;
    for (const item of category.items) {
      if (!item.available) continue;
      (item.images.length ? groups.with : groups.without).push(opens.get(item.id) ?? 0);
    }
  }
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const totalOpens = [...opens.values()].reduce((sum, value) => sum + value, 0);
  if (!groups.with.length || !groups.without.length || totalOpens < 20) return null;
  const ratio = average(groups.with) / Math.max(average(groups.without), 0.5);
  if (ratio < 1.5) return null;
  return (
    <section className="pro-card pro-insight">
      <span className="pro-tile">
        <Sparkles size={19} />
      </span>
      <div>
        <h2>Les photos font ouvrir les plats</h2>
        <p>
          Sur cette période, vos plats avec photo sont ouverts{" "}
          <b>{ratio.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}× plus</b>{" "}
          que les autres. {groups.without.length} plat
          {groups.without.length > 1 ? "s n’ont" : " n’a"} pas encore de photo.
        </p>
        <Link className="pro-btn dark small" href="/dashboard/menu?filtre=a-completer">
          <Camera size={15} /> Ajouter des photos
        </Link>
      </div>
    </section>
  );
}

function TopDishes({
  dishes,
  items,
}: {
  dishes: Stats["dishes"];
  items: Map<string, MenuItem>;
}) {
  const ranked = dishes.filter((dish) => dish.opens > 0).slice(0, 8);
  const max = ranked[0]?.opens ?? 1;
  return (
    <section className="pro-card" aria-labelledby="dishes-title">
      <div className="pro-card-head">
        <div>
          <h2 id="dishes-title">Plats les plus consultés</h2>
          <p>Ouvertures de la fiche du plat.</p>
        </div>
      </div>
      {ranked.length ? (
        <ol className="pro-ranking">
          {ranked.map((dish, index) => {
            const item = items.get(dish.itemId);
            const image = item?.images[0]?.dataUrl;
            return (
              <li key={dish.itemId}>
                <span className="pro-rank">{index + 1}</span>
                <span
                  className={`pro-thumb small ${image ? "" : "empty"}`}
                  style={image ? { backgroundImage: `url(${image})` } : undefined}
                >
                  {image ? null : <UtensilsCrossed size={14} />}
                </span>
                <span className="pro-meter-block">
                  <span className="pro-meter-top">
                    {dishName(item?.name ?? dish.name)}
                    <b>{numberFormat.format(dish.opens)}</b>
                  </span>
                  <span className="pro-meter">
                    <i style={{ width: `${(dish.opens / max) * 100}%` }} />
                  </span>
                  {item && !image ? (
                    <small className="pro-flag warn">
                      <Camera size={12} /> Sans photo
                    </small>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="pro-muted">Aucun plat consulté sur cette période.</p>
      )}
    </section>
  );
}

function TableHeatmap({
  tables,
  tableCount,
  days,
}: {
  tables: Stats["tables"];
  tableCount: number;
  days: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const active = tables.filter((table) => table.active);
  const max = Math.max(1, ...active.map((table) => table.scans));
  const anyScan = active.some((table) => table.scans > 0);
  const silent = anyScan ? active.filter((table) => table.scans === 0) : [];
  const current = tables.find((table) => table.table === selected);
  return (
    <section className="pro-card" aria-labelledby="tables-title">
      <div className="pro-card-head">
        <div>
          <h2 id="tables-title">Scans par table</h2>
          <p>
            {current
              ? `Table ${current.table} : ${current.scans} scans, ${formatDuration(current.averageDurationMs)} en moyenne, ${current.itemOpens} plats ouverts`
              : tableCount
                ? `${tableCount} tables · touchez une table pour le détail`
                : "Un QR code par table permet de comparer vos emplacements."}
          </p>
        </div>
      </div>
      {active.length ? (
        <>
          <div className="pro-heatmap">
            {active.map((table) => {
              const level = table.scans ? Math.round(15 + (table.scans / max) * 85) : 0;
              return (
                <button
                  key={table.table}
                  type="button"
                  className={`pro-cell ${level > 55 ? "dark" : ""} ${anyScan && !table.scans ? "zero" : ""}`}
                  style={
                    level
                      ? { background: `color-mix(in oklab, var(--accent) ${level}%, var(--surface))` }
                      : undefined
                  }
                  aria-pressed={selected === table.table}
                  aria-label={`Table ${table.table} : ${table.scans} scans`}
                  onClick={() => setSelected(selected === table.table ? null : table.table)}
                >
                  <span>T{table.table}</span>
                  <b>{table.scans}</b>
                </button>
              );
            })}
          </div>
          <div className="pro-legend">
            <span>Moins</span>
            <i />
            <span>Plus</span>
          </div>
          {silent.length ? (
            <p className="pro-banner danger">
              <AlertTriangle size={16} />
              <span>
                {silent.length === 1
                  ? `Table ${silent[0]!.table} : aucun scan sur ${days} jours.`
                  : `Tables ${silent.map((table) => table.table).join(", ")} : aucun scan sur ${days} jours.`}{" "}
                Le QR code est peut-être abîmé ou retiré.
              </span>
            </p>
          ) : null}
        </>
      ) : (
        <Link className="pro-btn line small" href="/dashboard/share">
          <QrCode size={15} /> Créer des QR codes par table
        </Link>
      )}
    </section>
  );
}

function Sources({ totals, tables }: { totals: Totals; tables: Stats["tables"] }) {
  const tableScans = tables.reduce((sum, table) => sum + table.scans, 0);
  const qrScans = Math.max(0, totals.scans - tableScans);
  const direct = Math.max(0, totals.visits - totals.scans);
  const visits = Math.max(1, totals.visits);
  if (!totals.visits) return null;
  const rows = [
    { label: "QR des tables", value: tableScans, icon: UtensilsCrossed },
    { label: "QR général (vitrine, flyers)", value: qrScans, icon: QrCode },
    { label: "Lien direct (réseaux, Google…)", value: direct, icon: Link2 },
  ];
  return (
    <section className="pro-card" aria-labelledby="sources-title">
      <div className="pro-card-head">
        <div>
          <h2 id="sources-title">D’où viennent les visites</h2>
          <p>{numberFormat.format(totals.visits)} visites sur la période.</p>
        </div>
      </div>
      <ul className="pro-ranking plain">
        {rows.map(({ label, value, icon: Icon }) => (
          <li key={label}>
            <span className="pro-tile small">
              <Icon size={15} />
            </span>
            <span className="pro-meter-block">
              <span className="pro-meter-top">
                {label}
                <b>{Math.round((value / visits) * 100)} %</b>
              </span>
              <span className="pro-meter">
                <i style={{ width: `${(value / visits) * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Videos({
  dishes,
  coverVideo,
  totals,
}: {
  dishes: Stats["dishes"];
  coverVideo: Stats["coverVideo"];
  totals: Totals;
}) {
  const rows = [
    ...(coverVideo
      ? [{ key: "cover", name: "Vidéo de couverture", plays: coverVideo.plays, completions: coverVideo.completions }]
      : []),
    ...dishes
      .filter((dish) => dish.videoPlays > 0)
      .map((dish) => ({
        key: dish.itemId,
        name: dishName(dish.name),
        plays: dish.videoPlays,
        completions: dish.videoCompletions,
      })),
  ].sort((a, b) => b.plays - a.plays);
  return (
    <section className="pro-card" aria-labelledby="videos-title">
      <div className="pro-card-head">
        <div>
          <h2 id="videos-title">Vidéos</h2>
          <p>Lectures lancées et vidéos regardées à 90 % ou plus.</p>
        </div>
      </div>
      <div className="pro-kpis two">
        <div className="pro-kpi">
          <span>Lectures</span>
          <strong>{numberFormat.format(totals.videoPlays)}</strong>
        </div>
        <div className="pro-kpi">
          <span>Vues en entier</span>
          <strong>{formatRate(totals.completionRate)}</strong>
        </div>
      </div>
      {rows.length ? (
        <table className="pro-table">
          <thead>
            <tr>
              <th scope="col">Vidéo</th>
              <th scope="col">Lectures</th>
              <th scope="col">En entier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td>{numberFormat.format(row.plays)}</td>
                <td>
                  {formatRate(row.plays ? Math.min(1, row.completions / row.plays) : null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
