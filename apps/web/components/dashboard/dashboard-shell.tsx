"use client";

import {
  BarChart3,
  Eye,
  LayoutDashboard,
  Palette,
  Plus,
  QrCode,
  Settings,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { useMenuStore } from "@/lib/menu-store";

const links = [
  {
    href: "/dashboard",
    label: "Vue d’ensemble",
    mobileLabel: "Accueil",
    icon: LayoutDashboard,
    mobile: true,
  },
  { href: "/dashboard/menu", label: "Menus", icon: Utensils, mobile: true },
  {
    href: "/dashboard/appearance",
    label: "Apparence",
    icon: Palette,
    mobile: true,
  },
  { href: "/dashboard/share", label: "Partager", icon: QrCode, mobile: true },
  {
    href: "/dashboard/stats",
    label: "Statistiques",
    icon: BarChart3,
    mobile: true,
  },
  {
    href: "/dashboard/settings",
    label: "Réglages",
    icon: Settings,
    mobile: false,
  },
] as const;

function VenueSwitcher({ mobile = false }: { mobile?: boolean }) {
  const {
    venues,
    selectedVenueId,
    selectVenue,
    canLoadMoreVenues,
    loadMoreVenues,
  } = useMenuStore();

  return (
    <div className={mobile ? "venue-switcher mobile" : "venue-switcher"}>
      <label htmlFor={mobile ? "active-venue-mobile" : "active-venue"}>
        Établissement actif
      </label>
      <div className="venue-switcher-row">
        <select
          id={mobile ? "active-venue-mobile" : "active-venue"}
          value={selectedVenueId}
          onChange={(event) => selectVenue(event.target.value)}
        >
          {venues.map((venue) => (
            <option value={venue.id} key={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
        <Link
          className="venue-add-button"
          href="/dashboard/establishments/new"
          aria-label="Ajouter un établissement"
          title="Ajouter un établissement"
        >
          <Plus size={17} />
        </Link>
      </div>
      {canLoadMoreVenues ? (
        <button
          className="venue-load-more"
          type="button"
          onClick={loadMoreVenues}
        >
          Afficher plus d’établissements
        </button>
      ) : null}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, publish } = useMenuStore();
  const isPublished = state.published?.publishedAt === state.changedAt;

  return (
    <ProtectedWorkspace mode="dashboard">
      <div className="dashboard-shell">
        <header className="site-header">
          <div className="container site-header-inner">
            <Brand />
            <nav className="header-nav">
              <Link
                className="button"
                href={`/menu/${state.venue.slug}`}
                target="_blank"
              >
                <Eye size={16} /> Aperçu
              </Link>
              <button
                className="button button-primary"
                type="button"
                onClick={publish}
              >
                {isPublished ? "Publié" : "Publier"}
              </button>
            </nav>
          </div>
        </header>
        <div className="dashboard-layout">
          <aside className="dashboard-nav">
            <VenueSwitcher />
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                className={`dashboard-link ${pathname === href ? "active" : ""}`}
                href={href}
                key={href}
              >
                <Icon size={16} /> {label}
              </Link>
            ))}
          </aside>
          <main className="dashboard-main">
            <VenueSwitcher mobile />
            {children}
          </main>
        </div>
        <nav
          className="dashboard-mobile-nav"
          aria-label="Navigation du tableau de bord"
        >
          {links
            .filter((link) => link.mobile)
            .map((link) => (
              <Link
                className={pathname === link.href ? "active" : ""}
                href={link.href}
                key={link.href}
              >
                <link.icon size={17} />
                <span>
                  {"mobileLabel" in link ? link.mobileLabel : link.label}
                </span>
              </Link>
            ))}
        </nav>
      </div>
    </ProtectedWorkspace>
  );
}
