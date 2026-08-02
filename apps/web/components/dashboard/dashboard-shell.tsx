"use client";

import {
  Eye,
  LayoutDashboard,
  Palette,
  QrCode,
  Settings,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Brand } from "@/components/brand";
import { useMenuStore } from "@/lib/menu-store";

const links = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/dashboard/menu", label: "Menus", icon: Utensils },
  { href: "/dashboard/appearance", label: "Apparence", icon: Palette },
  { href: "/dashboard/share", label: "Partager", icon: QrCode },
  { href: "/dashboard/settings", label: "Réglages", icon: Settings },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, publish } = useMenuStore();
  const isPublished = state.published?.publishedAt === state.changedAt;

  return (
    <div className="dashboard-shell">
      <header className="site-header">
        <div className="container site-header-inner">
          <Brand />
          <nav className="header-nav">
            <Link
              className="button"
              href={`/${state.venue.slug}`}
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
          <div className="dashboard-nav-title">{state.venue.name}</div>
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
        <main className="dashboard-main">{children}</main>
      </div>
      <nav
        className="dashboard-mobile-nav"
        aria-label="Navigation du tableau de bord"
      >
        {links.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            className={pathname === href ? "active" : ""}
            href={href}
            key={href}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
