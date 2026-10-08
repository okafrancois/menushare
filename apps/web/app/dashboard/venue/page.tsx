"use client";

import {
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Info,
  LogOut,
  Palette,
  Plus,
  QrCode,
  RotateCcw,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { VenueAvatar } from "@/components/dashboard/dashboard-shell";
import { VenueLifecycle } from "@/components/dashboard/venue-lifecycle";
import { errorMessage, PageHead, useToast } from "@/components/dashboard/ui";
import { authClient } from "@/lib/auth-client";
import { useMenuStore } from "@/lib/menu-store";
import { hoursSummary } from "@/lib/opening-hours";

function HubRow({
  href,
  icon,
  title,
  detail,
  trailing,
}: {
  href: Route;
  icon: ReactNode;
  title: string;
  detail: string;
  trailing?: ReactNode;
}) {
  return (
    <li>
      <Link className="pro-hub-row" href={href}>
        <span className="pro-tile">{icon}</span>
        <span className="pro-row-copy">
          <strong>{title}</strong>
          <small>{detail}</small>
        </span>
        {trailing}
        <ChevronRight size={17} className="pro-chevron" />
      </Link>
    </li>
  );
}

export default function VenueHubPage() {
  const { state, remote, venues, resetDemo } = useMenuStore();
  const toast = useToast();
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const { venue } = state;
  const url = `${origin}/menu/${venue.slug}`;
  const hours =
    hoursSummary(venue.openingHours) || venue.hours || "À renseigner";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien de la carte copié");
    } catch {
      toast(url);
    }
  }

  return (
    <>
      <PageHead title="Établissement" />
      <section className="pro-card pro-venue-hero">
        <div
          className="pro-venue-cover"
          style={
            venue.coverImageDataUrl
              ? { backgroundImage: `url(${venue.coverImageDataUrl})` }
              : { background: venue.accentColor }
          }
        />
        <div className="pro-venue-body">
          <VenueAvatar
            name={venue.name}
            logo={venue.logoDataUrl}
            accent={venue.accentColor}
            size="lg"
          />
          <h2>{venue.name}</h2>
          <p>{[venue.kind, venue.city].filter(Boolean).join(" · ")}</p>
          <div className="pro-url">
            <code>{url.replace(/^https?:\/\//, "")}</code>
            <button
              className="pro-icon-btn plain"
              type="button"
              aria-label="Copier l’URL"
              onClick={copy}
            >
              <Copy size={17} />
            </button>
            <Link
              className="pro-icon-btn plain"
              href={`/menu/${venue.slug}`}
              target="_blank"
              aria-label="Ouvrir la carte publique"
            >
              <ExternalLink size={17} />
            </Link>
          </div>
        </div>
      </section>

      <h2 className="pro-group-title">Partage</h2>
      <ul className="pro-card pro-hub">
        <HubRow
          href="/dashboard/share"
          icon={<QrCode size={19} />}
          title="QR codes et tables"
          detail={
            venue.tableCount
              ? `QR général · ${venue.tableCount} table${venue.tableCount > 1 ? "s" : ""}`
              : "QR général · aucune table"
          }
        />
      </ul>

      <h2 className="pro-group-title">Votre carte</h2>
      <ul className="pro-card pro-hub">
        <HubRow
          href="/dashboard/appearance"
          icon={<Palette size={19} />}
          title="Apparence"
          detail="Logo, couverture, couleur, vidéo"
          trailing={
            <span
              className="pro-swatch"
              style={{ background: venue.accentColor }}
              aria-hidden="true"
            />
          }
        />
        <HubRow
          href="/dashboard/settings"
          icon={<Info size={19} />}
          title="Informations"
          detail="Nom, adresse, téléphone, présentation"
        />
        <HubRow
          href={"/dashboard/settings#horaires" as Route}
          icon={<Clock3 size={19} />}
          title="Horaires d’ouverture"
          detail={hours}
        />
      </ul>

      <h2 className="pro-group-title">Compte</h2>
      <ul className="pro-card pro-hub">
        <HubRow
          href="/dashboard/account"
          icon={<Info size={19} />}
          title="Mon compte"
          detail="Profil, connexions et données"
        />
        <HubRow
          href="/help"
          icon={<Info size={19} />}
          title="Aide et prise en main"
          detail="Publication, QR codes, photos et questions fréquentes"
        />
        <HubRow
          href="/dashboard/establishments/new"
          icon={<Plus size={19} />}
          title="Ajouter un établissement"
          detail={`${venues.length} établissement${venues.length > 1 ? "s" : ""} sur ce compte`}
        />
        {remote ? (
          <li>
            <button
              className="pro-hub-row"
              type="button"
              onClick={async () => {
                try {
                  await authClient.signOut();
                  router.replace("/sign-in");
                } catch (cause) {
                  toast(errorMessage(cause));
                }
              }}
            >
              <span className="pro-tile neutral">
                <LogOut size={19} />
              </span>
              <span className="pro-row-copy">
                <strong>Se déconnecter</strong>
                <small>Vos données restent enregistrées</small>
              </span>
            </button>
          </li>
        ) : (
          <li>
            <button
              className="pro-hub-row"
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Réinitialiser toutes les données locales de la démo ?",
                  )
                ) {
                  void resetDemo();
                  toast("Démo réinitialisée");
                }
              }}
            >
              <span className="pro-tile neutral">
                <RotateCcw size={19} />
              </span>
              <span className="pro-row-copy">
                <strong>Réinitialiser la démo</strong>
                <small>Remet les données de Nonna Lydie</small>
              </span>
            </button>
          </li>
        )}
      </ul>
      <div className="pro-utility-links">
        <Link href="/dashboard/history">Historique des publications</Link>
        <Link href="/dashboard/tools">Importer et exporter</Link>
      </div>
      <VenueLifecycle />
    </>
  );
}
