"use client";

import { ArrowRight, Eye, Palette, QrCode, Utensils } from "lucide-react";
import Link from "next/link";

import { MenuPhonePreview } from "@/components/menu/menu-phone-preview";
import { useMenuStore } from "@/lib/menu-store";

export default function DashboardPage() {
  const { state } = useMenuStore();
  const itemCount = state.categories.reduce(
    (total, category) => total + category.items.length,
    0,
  );
  const published = Boolean(state.published);

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">Tableau de bord</span>
          <h1 className="serif">Bonjour, {state.venue.name}</h1>
        </div>
        <Link className="button button-dark" href={`/${state.venue.slug}`}>
          <Eye size={16} /> Voir le menu
        </Link>
      </div>
      <div className="overview-grid">
        <section>
          <div className="stat-grid">
            <article className="stat-card">
              <span>Catégories</span>
              <strong>{state.categories.length}</strong>
            </article>
            <article className="stat-card">
              <span>Plats</span>
              <strong>{itemCount}</strong>
            </article>
            <article className="stat-card">
              <span>Statut</span>
              <strong className="status-text">
                {published ? "En ligne" : "Brouillon"}
              </strong>
            </article>
          </div>
          <div className="quick-grid">
            <Link className="quick-card" href="/dashboard/menu">
              <Utensils />
              <div>
                <strong>Composer le menu</strong>
                <p>Catégories, plats, prix et médias</p>
              </div>
              <ArrowRight />
            </Link>
            <Link className="quick-card" href="/dashboard/appearance">
              <Palette />
              <div>
                <strong>Personnaliser</strong>
                <p>Logo, couverture et couleur</p>
              </div>
              <ArrowRight />
            </Link>
            <Link className="quick-card" href="/dashboard/share">
              <QrCode />
              <div>
                <strong>Partager</strong>
                <p>URL publique et QR code</p>
              </div>
              <ArrowRight />
            </Link>
          </div>
        </section>
        <aside className="builder-preview">
          <MenuPhonePreview venue={state.venue} categories={state.categories} />
        </aside>
      </div>
    </>
  );
}
