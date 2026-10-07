"use client";

import { api } from "@repo/backend/api";
import type { Id } from "@repo/backend/data-model";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BarChart3, QrCode, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatDuration, formatRate, statsDay } from "@/lib/menu-analytics";
import { useMenuStore } from "@/lib/menu-store";

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
] as const;

type Stats = FunctionReturnType<typeof api.analytics.getStats>;

const numberFormat = new Intl.NumberFormat("fr-FR");
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDay(day: string) {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export default function StatsPage() {
  const { state, remote } = useMenuStore();
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(30);

  return (
    <>
      <div className="dashboard-head stats-head">
        <div>
          <span className="eyebrow">Mesure d’audience</span>
          <h1 className="serif">Statistiques</h1>
        </div>
        <div className="period-switch" role="group" aria-label="Période">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              className={period.days === days ? "active" : ""}
              aria-pressed={period.days === days}
              onClick={() => setDays(period.days)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      {remote && state.venue.id ? (
        <RemoteStats venueId={state.venue.id as Id<"venues">} days={days} />
      ) : (
        <div className="empty-state">
          <h2 className="serif">Aucune statistique en mode démo.</h2>
          <p>
            Les visites sont mesurées dès que votre menu est publié depuis un
            compte MenuShare.
          </p>
        </div>
      )}
    </>
  );
}

function RemoteStats({
  venueId,
  days,
}: {
  venueId: Id<"venues">;
  days: number;
}) {
  // Passed to the query (which must not read the clock) and refreshed after
  // midnight so a dashboard left open keeps a window ending today.
  const [today, setToday] = useState(() => statsDay(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(statsDay(Date.now())),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const stats = useQuery(api.analytics.getStats, { venueId, today, days });

  if (stats === undefined) {
    return <p className="stats-loading">Chargement des statistiques…</p>;
  }
  return <StatsReport stats={stats} />;
}

function StatsReport({ stats }: { stats: Stats }) {
  const { totals } = stats;
  const kpis = [
    {
      label: "Scans du QR code",
      value: numberFormat.format(totals.scans),
      hint: `${numberFormat.format(totals.visits)} visites au total`,
    },
    {
      label: "Visiteurs uniques",
      value: numberFormat.format(totals.uniqueVisitors),
      hint: "Personnes différentes",
    },
    {
      label: "Temps moyen",
      value: formatDuration(totals.averageDurationMs),
      hint: "Passé sur le menu par visite",
    },
    {
      label: "Plats consultés",
      value: numberFormat.format(totals.itemOpens),
      hint: "Fiches de plats ouvertes",
    },
    {
      label: "Vidéos regardées",
      value: numberFormat.format(totals.videoPlays),
      hint: "Lectures lancées",
    },
    {
      label: "Taux de complétion",
      value: formatRate(totals.completionRate),
      hint: "Vidéos vues à 90 % ou plus",
    },
  ];

  return (
    <div className="stats-stack">
      <div className="stat-grid stats-kpis">
        {kpis.map((kpi) => (
          <article className="stat-card" key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.hint}</small>
          </article>
        ))}
      </div>
      <DailyChart daily={stats.daily} />
      <div className="stats-columns">
        <TopDishes dishes={stats.dishes} />
        <VideoTable dishes={stats.dishes} coverVideo={stats.coverVideo} />
      </div>
      <TableReport tables={stats.tables} tableCount={stats.tableCount} />
      <div className="info-banner">
        <ShieldCheck />
        <div>
          <strong>Mesure anonyme</strong>
          <p>
            Aucun cookie publicitaire ni adresse IP. Vos propres visites, quand
            vous êtes connecté, ne sont pas comptées.
          </p>
        </div>
      </div>
    </div>
  );
}

function DailyChart({ daily }: { daily: Stats["daily"] }) {
  const max = Math.max(1, ...daily.map((day) => day.visits));
  const total = daily.reduce((sum, day) => sum + day.visits, 0);
  return (
    <section className="settings-card stats-card">
      <h2>
        <BarChart3 size={18} /> Visites par jour
      </h2>
      <p>
        Barre pleine : visites venues d’un QR code. Barre claire : liens
        directs.
      </p>
      {total ? (
        <>
          <div
            className="stats-chart"
            role="img"
            aria-label={`${total} visites sur la période`}
          >
            {daily.map((day) => (
              <div
                className="stats-bar"
                key={day.day}
                title={`${formatDay(day.day)} : ${day.visits} visites, dont ${day.scans} scans`}
              >
                <span
                  className="stats-bar-total"
                  style={{ height: `${(day.visits / max) * 100}%` }}
                >
                  <span
                    className="stats-bar-scans"
                    style={{
                      height: day.visits
                        ? `${(day.scans / day.visits) * 100}%`
                        : 0,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
          <div className="stats-axis">
            <span>{formatDay(daily[0]!.day)}</span>
            <span>{formatDay(daily.at(-1)!.day)}</span>
          </div>
        </>
      ) : (
        <p className="stats-empty">
          Aucune visite sur cette période. Imprimez votre QR code depuis la page
          Partager pour commencer.
        </p>
      )}
    </section>
  );
}

function dishName(name: string | null) {
  return name ?? "Plat supprimé";
}

function TopDishes({ dishes }: { dishes: Stats["dishes"] }) {
  const ranked = dishes.filter((dish) => dish.opens > 0).slice(0, 10);
  const max = ranked[0]?.opens ?? 1;
  return (
    <section className="settings-card stats-card">
      <h2>
        <Trophy size={18} /> Plats les plus consultés
      </h2>
      <p>Ce qui attire l’attention de vos clients.</p>
      {ranked.length ? (
        <>
          <div className="stats-highlight">
            <span className="eyebrow">Plat le plus consulté</span>
            <strong className="serif">{dishName(ranked[0]!.name)}</strong>
            <small>{numberFormat.format(ranked[0]!.opens)} consultations</small>
          </div>
          <ol className="stats-ranking">
            {ranked.map((dish) => (
              <li key={dish.itemId}>
                <div>
                  <span>{dishName(dish.name)}</span>
                  <strong>{numberFormat.format(dish.opens)}</strong>
                </div>
                <span
                  className="stats-meter"
                  style={{ width: `${(dish.opens / max) * 100}%` }}
                />
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="stats-empty">Aucun plat consulté sur cette période.</p>
      )}
    </section>
  );
}

function VideoTable({
  dishes,
  coverVideo,
}: {
  dishes: Stats["dishes"];
  coverVideo: Stats["coverVideo"];
}) {
  const rows = [
    ...(coverVideo
      ? [
          {
            key: "cover",
            name: "Vidéo de couverture",
            plays: coverVideo.plays,
            completions: coverVideo.completions,
          },
        ]
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
    <section className="settings-card stats-card">
      <h2>Vidéos</h2>
      <p>Lectures lancées et vidéos réellement regardées jusqu’au bout.</p>
      {rows.length ? (
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Vidéo</th>
              <th scope="col">Lectures</th>
              <th scope="col">Complétion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td>{numberFormat.format(row.plays)}</td>
                <td>
                  {formatRate(
                    row.plays ? Math.min(1, row.completions / row.plays) : null,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="stats-empty">Aucune vidéo lancée sur cette période.</p>
      )}
    </section>
  );
}

function TableReport({
  tables,
  tableCount,
}: {
  tables: Stats["tables"];
  tableCount: number;
}) {
  return (
    <section className="settings-card stats-card">
      <h2>
        <QrCode size={18} /> Performance par table
      </h2>
      <p>Scans et engagement selon l’emplacement du QR code.</p>
      {tables.length ? (
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Table</th>
              <th scope="col">Scans</th>
              <th scope="col">Temps moyen</th>
              <th scope="col">Plats consultés</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((row) => (
              <tr key={row.table} className={row.active ? "" : "muted"}>
                <td>
                  Table {row.table}
                  {row.active ? "" : " (retirée)"}
                </td>
                <td>{numberFormat.format(row.scans)}</td>
                <td>{formatDuration(row.averageDurationMs)}</td>
                <td>{numberFormat.format(row.itemOpens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="stats-empty">
          {tableCount
            ? "Aucun scan de table sur cette période."
            : "Créez un QR code par table pour comparer vos emplacements."}{" "}
          <Link href="/dashboard/share">Gérer les QR codes</Link>
        </p>
      )}
    </section>
  );
}
