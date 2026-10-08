"use client";

import { api } from "@repo/backend/api";
import type { Id } from "@repo/backend/data-model";
import { useQuery } from "convex/react";
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Link2,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { QrSheet } from "@/components/dashboard/qr-sheet";
import { SpecialSheet } from "@/components/dashboard/special-sheet";
import {
  errorMessage,
  PageHead,
  Switch,
  useToast,
} from "@/components/dashboard/ui";
import { formatDuration, statsDay } from "@/lib/menu-analytics";
import { formatPrice, type MenuItem } from "@/lib/menu-domain";
import { normalizeSearch } from "@/lib/menu-filters";
import { useMenuStore } from "@/lib/menu-store";
import { completionCounts } from "@/lib/menu-quality";
import { DAY_NAMES, formatTime, parisTime } from "@/lib/opening-hours";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function menuUrl(slug: string) {
  return `${window.location.origin}/menu/${slug}`;
}

export default function ServicePage() {
  const { state, remote } = useMenuStore();
  const now = useNow();
  const [qrOpen, setQrOpen] = useState(false);
  const toast = useToast();
  const time = now === null ? null : parisTime(now);
  const evening = time ? time.minutes >= 16 * 60 : false;
  const { withoutPhoto, withoutAllergens } = completionCounts(state.categories);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl(state.venue.slug));
      toast("Lien de la carte copié");
    } catch {
      toast(menuUrl(state.venue.slug));
    }
  }

  async function share() {
    const url = menuUrl(state.venue.slug);
    try {
      if (navigator.share) await navigator.share({ title: state.venue.name, url });
      else await copyLink();
    } catch {
      // Sharing cancelled.
    }
  }

  return (
    <>
      <PageHead
        eyebrow={
          now === null
            ? "Service"
            : `${dateFormat.format(now)} · service du ${evening ? "soir" : "midi"}`
        }
        title={`${evening ? "Bonsoir" : "Bonjour"}, ${state.venue.name}`}
      />

      {remote && state.venue.id ? (
        <RemoteToday venueId={state.venue.id as Id<"venues">} now={now} />
      ) : (
        <section className="pro-card">
          <div className="pro-card-head">
            <div>
              <h2>Aujourd’hui</h2>
              <p>Les scans, plats consultés et temps de lecture s’affichent ici dès que votre carte est publiée depuis un compte MenuShare.</p>
            </div>
          </div>
        </section>
      )}

      <AvailabilityCard moment={evening ? "ce soir" : "ce midi"} />
      <SpecialCard />

      {withoutPhoto || withoutAllergens ? (
        <section className="pro-card pro-insight">
          <span className="pro-tile">
            <Sparkles size={19} />
          </span>
          <div>
            <h2>À compléter sur votre carte</h2>
            <ul>
              {withoutPhoto ? (
                <li>
                  <Camera size={15} /> {withoutPhoto} plat
                  {withoutPhoto > 1 ? "s" : ""} sans photo : la photo est ce qui
                  donne envie d’ouvrir un plat.
                </li>
              ) : null}
              {withoutAllergens ? (
                <li>
                  <ShieldAlert size={15} /> {withoutAllergens} plat
                  {withoutAllergens > 1 ? "s" : ""} sans allergènes renseignés :
                  ils sont masqués aux clients qui filtrent.
                </li>
              ) : null}
            </ul>
            <Link className="pro-btn dark small" href="/dashboard/menu?filtre=a-completer">
              Compléter la carte
            </Link>
          </div>
        </section>
      ) : null}

      <div className="pro-quick">
        <button type="button" onClick={() => setQrOpen(true)}>
          <QrCode size={20} /> Afficher le QR
        </button>
        <button type="button" onClick={copyLink}>
          <Link2 size={20} /> Copier le lien
        </button>
        <button type="button" onClick={share}>
          <Share2 size={20} /> Partager
        </button>
      </div>

      {qrOpen ? <QrSheet onClose={() => setQrOpen(false)} /> : null}
    </>
  );
}

function RemoteToday({
  venueId,
  now,
}: {
  venueId: Id<"venues">;
  now: number | null;
}) {
  const today = now === null ? null : statsDay(now);
  const summary = useQuery(
    api.analytics.getDaySummary,
    today ? { venueId, today } : "skip",
  );
  const weekday = now === null ? "" : DAY_NAMES[parisTime(now).day]!.toLowerCase();
  return (
    <section className="pro-card">
      <div className="pro-card-head">
        <div>
          <h2>Aujourd’hui</h2>
          <p>
            {summary
              ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} dernier : ${summary.sameDayLastWeek.scans} scans sur la journée`
              : "Chargement…"}
          </p>
        </div>
        <Link className="pro-link" href="/dashboard/stats">
          Détails
        </Link>
      </div>
      <div className="pro-kpis three">
        <div className="pro-kpi">
          <span>Scans</span>
          <strong>{summary?.today.scans ?? "—"}</strong>
        </div>
        <div className="pro-kpi">
          <span>Plats vus</span>
          <strong>{summary?.today.itemOpens ?? "—"}</strong>
        </div>
        <div className="pro-kpi">
          <span>Lecture</span>
          <strong>
            {summary ? formatDuration(summary.today.averageDurationMs) : "—"}
          </strong>
        </div>
      </div>
    </section>
  );
}

function AvailabilityCard({ moment }: { moment: string }) {
  const { state, setSoldOut, setAutoRestock } = useMenuStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const soldOut = useMemo(
    () => new Set(state.live.soldOutIds),
    [state.live.soldOutIds],
  );
  const items = state.categories
    .flatMap((category) => category.items)
    .filter((item) => item.available);
  const needle = normalizeSearch(query);
  const visible = needle
    ? items.filter((item) => normalizeSearch(item.name).includes(needle))
    : [
        ...items.filter((item) => soldOut.has(item.id)),
        ...items.filter((item) => !soldOut.has(item.id)),
      ].slice(0, Math.max(6, soldOut.size + 3));

  async function toggle(item: MenuItem, available: boolean) {
    try {
      await setSoldOut(item.id, !available);
      toast(
        available
          ? `${item.name} est de retour sur la carte`
          : `${item.name} épuisé · affiché comme tel en salle`,
      );
    } catch (cause) {
      toast(errorMessage(cause));
    }
  }

  return (
    <section className="pro-card" aria-labelledby="availability-title">
      <div className="pro-card-head">
        <div>
          <h2 id="availability-title">Disponibilité {moment}</h2>
          <p>
            Un plat épuisé est signalé en salle immédiatement, sans republier.
          </p>
        </div>
      </div>
      {items.length > 6 ? (
        <label className="pro-search small">
          <Search size={16} />
          <span className="sr-only">Chercher un plat</span>
          <input
            placeholder="Chercher un plat"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}
      {items.length ? (
        <ul className="pro-rows">
          {visible.map((item) => {
            const available = !soldOut.has(item.id);
            return (
              <li key={item.id} className={`pro-row ${available ? "" : "off"}`}>
                <span
                  className={`pro-thumb ${item.images[0] ? "" : "empty"}`}
                  style={
                    item.images[0]
                      ? { backgroundImage: `url(${item.images[0].dataUrl})` }
                      : undefined
                  }
                />
                <span className="pro-row-copy">
                  <strong>{item.name}</strong>
                  <small>
                    {available ? formatPrice(item.priceCents) : "Épuisé · affiché en salle"}
                  </small>
                </span>
                <Switch
                  checked={available}
                  label={`Disponibilité de ${item.name}`}
                  onChange={(next) => toggle(item, next)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pro-muted">Ajoutez des plats à votre carte pour gérer leur disponibilité.</p>
      )}
      <Link className="pro-row-link" href="/dashboard/menu">
        Toute la carte <ChevronRight size={16} />
      </Link>
      <div className="pro-row with-border">
        <span className="pro-tile neutral">
          <RotateCcw size={17} />
        </span>
        <span className="pro-row-copy">
          <strong>Remettre en stock chaque nuit</strong>
          <small>Les plats épuisés redeviennent disponibles vers 4 h</small>
        </span>
        <Switch
          checked={state.live.autoRestock}
          label="Remise en stock automatique"
          onChange={async (next) => {
            try {
              await setAutoRestock(next);
            } catch (cause) {
              toast(errorMessage(cause));
            }
          }}
        />
      </div>
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function SpecialCard() {
  const { state, clearDailySpecial } = useMenuStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const special = state.live.special;
  const now = useNow();
  const active = special && (now === null || special.endsAt > now);
  const endLabel = special
    ? formatTime(timeFormat.format(special.endsAt).replace(" ", ""))
    : "";

  return (
    <section className="pro-card" aria-labelledby="special-title">
      <div className="pro-card-head">
        <div>
          <h2 id="special-title">Suggestion du jour</h2>
          <p>En tête de carte, retirée automatiquement à l’heure choisie.</p>
        </div>
        {active ? <span className="pro-tag good">En ligne</span> : null}
      </div>
      {active && special ? (
        <>
          <div className="pro-special">
            {special.imageUrl ? (
              <img src={special.imageUrl} alt="" />
            ) : (
              <span className="pro-tile">
                <CalendarDays size={20} />
              </span>
            )}
            <span>
              <strong>{special.name}</strong>
              <small>
                {formatPrice(special.priceCents)} · retirée à {endLabel}
              </small>
            </span>
          </div>
          <div className="pro-btn-row">
            <button className="pro-btn ghost small" type="button" onClick={() => setEditing(true)}>
              Modifier
            </button>
            <button
              className="pro-btn line small"
              type="button"
              onClick={async () => {
                try {
                  await clearDailySpecial();
                  toast("Suggestion retirée de la carte");
                } catch (cause) {
                  toast(errorMessage(cause));
                }
              }}
            >
              Retirer
            </button>
          </div>
        </>
      ) : (
        <button className="pro-btn primary block" type="button" onClick={() => setEditing(true)}>
          Proposer une suggestion du jour
        </button>
      )}
      {editing ? (
        <SpecialSheet
          special={active ? special : undefined}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </section>
  );
}
