"use client";

import {
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  Home,
  Info,
  Plus,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Brand } from "@/components/brand";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import {
  ProSheet,
  SheetHead,
  ToastProvider,
  errorMessage,
  useToast,
} from "@/components/dashboard/ui";
import { useMenuStore } from "@/lib/menu-store";
import { usePublication } from "@/lib/use-publication";

const VENUE_PATHS = [
  "/dashboard/venue",
  "/dashboard/share",
  "/dashboard/appearance",
  "/dashboard/settings",
  "/dashboard/establishments",
];

const NAV = [
  {
    href: "/dashboard",
    label: "Service",
    icon: Home,
    match: (path: string) => path === "/dashboard",
  },
  {
    href: "/dashboard/menu",
    label: "Carte",
    icon: BookOpen,
    match: (path: string) => path.startsWith("/dashboard/menu"),
  },
  {
    href: "/dashboard/stats",
    label: "Stats",
    icon: BarChart3,
    match: (path: string) => path.startsWith("/dashboard/stats"),
  },
  {
    href: "/dashboard/venue",
    label: "Établissement",
    icon: Store,
    match: (path: string) => VENUE_PATHS.some((prefix) => path.startsWith(prefix)),
  },
] as const;

export function venueInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "M"
  );
}

export function VenueAvatar({
  name,
  logo,
  accent,
  size = "md",
}: {
  name: string;
  logo?: string;
  accent: string;
  size?: "md" | "lg";
}) {
  return logo ? (
    <img className={`pro-avatar ${size}`} src={logo} alt="" />
  ) : (
    <span
      className={`pro-avatar ${size}`}
      style={{ background: accent }}
      aria-hidden="true"
    >
      {venueInitials(name)}
    </span>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedWorkspace mode="dashboard">
      <ToastProvider>
        <ShellLayout>{children}</ShellLayout>
      </ToastProvider>
    </ProtectedWorkspace>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useMenuStore();
  const [venueSheet, setVenueSheet] = useState(false);
  const { online, pending, changes, version } = usePublication();
  const status = !online
    ? "Pas encore en ligne"
    : pending
      ? `En ligne · v${version} · ${changes.length} en attente`
      : `En ligne · v${version}`;
  const venueButton = (
    <button
      className="pro-venue-btn"
      type="button"
      onClick={() => setVenueSheet(true)}
      aria-label={`Établissement actif : ${state.venue.name}. Changer d’établissement`}
    >
      <VenueAvatar
        name={state.venue.name}
        logo={state.venue.logoDataUrl}
        accent={state.venue.accentColor}
      />
      <span className="pro-venue-copy">
        <strong>
          {state.venue.name} <ChevronDown size={14} />
        </strong>
        <span className={`pro-status ${!online || pending ? "pending" : ""}`}>
          <span className="pro-status-dot" aria-hidden="true" />
          {status}
        </span>
      </span>
    </button>
  );

  return (
    <div className="pro-root">
      <aside className="pro-sidebar">
        <Brand />
        {venueButton}
        <nav className="pro-side-nav" aria-label="Navigation principale">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={match(pathname) ? "on" : ""}
              aria-current={match(pathname) ? "page" : undefined}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <Link
          className="pro-side-preview"
          href={`/menu/${state.venue.slug}`}
          target="_blank"
        >
          <Eye size={16} /> Voir la carte en ligne
        </Link>
      </aside>

      <header className="pro-topbar">
        {venueButton}
        <Link
          className="pro-icon-btn"
          href={`/menu/${state.venue.slug}`}
          target="_blank"
          aria-label="Voir la carte en ligne"
        >
          <Eye size={19} />
        </Link>
      </header>

      <main className="pro-main">{children}</main>

      <PublishBar />

      <nav className="pro-tabbar" aria-label="Navigation du tableau de bord">
        {NAV.map(({ href, label, icon: Icon, match }) => (
          <Link
            key={href}
            href={href}
            className={match(pathname) ? "on" : ""}
            aria-current={match(pathname) ? "page" : undefined}
          >
            <span className="pro-tab-icon">
              <Icon size={20} />
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {venueSheet ? <VenueSheet onClose={() => setVenueSheet(false)} /> : null}
    </div>
  );
}

function PublishBar() {
  const { publish } = useMenuStore();
  const { online, pending, changes, version } = usePublication();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await publish();
      setOpen(false);
      toast(`Carte publiée · v${version + 1}. Visible en salle maintenant.`);
    } catch (cause) {
      toast(errorMessage(cause, "Publication impossible, réessayez."));
    } finally {
      setBusy(false);
    }
  }

  if (!pending) return null;
  const title = online
    ? `${changes.length} modification${changes.length > 1 ? "s" : ""} en attente`
    : "Votre carte n’est pas encore en ligne";
  return (
    <>
      <div className="pro-publish-bar" role="region" aria-label="Publication">
        <button
          className="pro-publish-info"
          type="button"
          onClick={() => setOpen(true)}
        >
          <span className="pro-pulse" aria-hidden="true" />
          <span>
            <b>{title}</b>
            <span>
              {online
                ? "Visibles en salle après publication"
                : "Publiez-la pour activer le QR code"}
            </span>
          </span>
        </button>
        <button
          className="pro-btn primary small"
          type="button"
          onClick={run}
          disabled={busy}
        >
          {busy ? "Publication…" : "Publier"}
        </button>
      </div>
      {open ? (
        <ProSheet onClose={() => setOpen(false)} labelledBy="publish-title">
          <SheetHead
            id="publish-title"
            title={online ? title : "Première publication"}
            onClose={() => setOpen(false)}
          />
          <div className="pro-sheet-body">
            {online ? (
              <ul className="pro-changes">
                {changes.map((change) => (
                  <li key={change.id}>
                    <strong>{change.title}</strong>
                    <span>{change.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pro-muted">
                Votre carte sera visible à son adresse publique et via vos QR
                codes dès la publication.
              </p>
            )}
            <p className="pro-note">
              <Info size={16} />
              <span>
                Les ruptures et la suggestion du jour sont déjà en ligne : elles
                ne passent pas par la publication.
              </span>
            </p>
          </div>
          <footer className="pro-sheet-foot">
            <button
              className="pro-btn primary block"
              type="button"
              onClick={run}
              disabled={busy}
            >
              {busy ? "Publication…" : `Publier la version ${version + 1}`}
            </button>
          </footer>
        </ProSheet>
      ) : null}
    </>
  );
}

function VenueSheet({ onClose }: { onClose: () => void }) {
  const {
    venues,
    selectedVenueId,
    selectVenue,
    canLoadMoreVenues,
    loadMoreVenues,
    state,
  } = useMenuStore();
  const toast = useToast();
  return (
    <ProSheet onClose={onClose} labelledBy="venues-title">
      <SheetHead id="venues-title" title="Mes établissements" onClose={onClose} />
      <div className="pro-sheet-body">
        <ul className="pro-venue-list">
          {venues.map((venue) => {
            const selected = venue.id === selectedVenueId;
            return (
              <li key={venue.id}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    selectVenue(venue.id);
                    onClose();
                    if (!selected) toast(`${venue.name} sélectionné`);
                  }}
                >
                  <VenueAvatar
                    name={venue.name}
                    accent={selected ? state.venue.accentColor : "#5d534b"}
                    logo={selected ? state.venue.logoDataUrl : undefined}
                  />
                  <span>
                    <strong>{venue.name}</strong>
                    <small>
                      {[venue.kind, venue.city].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  {selected ? <Check size={18} className="pro-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {canLoadMoreVenues ? (
          <button className="pro-btn ghost block" type="button" onClick={loadMoreVenues}>
            Afficher plus d’établissements
          </button>
        ) : null}
        <Link
          className="pro-add-venue"
          href="/dashboard/establishments/new"
          onClick={onClose}
          aria-label="Ajouter un établissement"
        >
          <span className="pro-avatar ghost">
            <Plus size={18} />
          </span>
          <span>
            <strong>Ajouter un établissement</strong>
            <small>Restaurant, bar, traiteur, food-truck…</small>
          </span>
        </Link>
      </div>
    </ProSheet>
  );
}
