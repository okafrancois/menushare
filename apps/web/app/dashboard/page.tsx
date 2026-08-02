import { Eye, GripVertical, ImageIcon, Palette, Plus, QrCode, Settings, Utensils } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { MenuPhonePreview } from "@/components/menu/menu-phone-preview";
import { demoVenue, formatPrice } from "@/lib/demo-menu";

export const metadata = { title: "Composer le menu" };

export default function DashboardPage() {
  return (
    <div className="dashboard-shell">
      <header className="site-header">
        <div className="container site-header-inner">
          <Brand />
          <nav className="header-nav">
            <Link className="button" href={`/${demoVenue.slug}`}><Eye size={16} /> Aperçu</Link>
            <button className="button button-primary" type="button">Publier</button>
          </nav>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-nav">
          <div className="dashboard-nav-title">{demoVenue.name}</div>
          <div className="dashboard-link"><Eye size={16} /> Vue d’ensemble</div>
          <div className="dashboard-link active"><Utensils size={16} /> Menus</div>
          <div className="dashboard-link"><ImageIcon size={16} /> Médiathèque</div>
          <div className="dashboard-link"><Palette size={16} /> Apparence</div>
          <div className="dashboard-link"><QrCode size={16} /> Partager</div>
          <div className="dashboard-link"><Settings size={16} /> Réglages</div>
        </aside>

        <main className="dashboard-main">
          <div className="dashboard-head">
            <div><span className="eyebrow">Menu principal · Brouillon</span><h1 className="serif">Composer le menu</h1></div>
            <button className="button button-dark" type="button"><Plus size={16} /> Catégorie</button>
          </div>

          <div className="builder-grid">
            <section>
              {demoVenue.categories.map((category) => (
                <article className="builder-section" key={category.id}>
                  <div className="builder-section-head">
                    <div><h2>{category.name}</h2><p>{category.items.length} plats · Glissez pour réordonner</p></div>
                    <button className="button" type="button" aria-label={`Actions pour ${category.name}`}>•••</button>
                  </div>
                  {category.items.map((item) => (
                    <div className="menu-row" key={item.id}>
                      <GripVertical size={18} color="#9a9086" />
                      <span className="menu-row-art">{item.video ? <span>▶</span> : <ImageIcon size={18} />}</span>
                      <div><h3>{item.name}</h3><p>{item.description}</p><p>{item.video ? `${item.video.provider} · Vidéo externe` : "Image · Publié"}</p></div>
                      <span className="menu-row-price">{formatPrice(item.priceCents)}</span>
                    </div>
                  ))}
                  <button className="button" style={{ marginTop: 12 }} type="button"><Plus size={15} /> Ajouter un plat</button>
                </article>
              ))}
            </section>
            <aside className="builder-preview"><MenuPhonePreview /></aside>
          </div>
        </main>
      </div>

      <nav className="dashboard-mobile-nav" aria-label="Navigation du tableau de bord"><span>Accueil</span><span className="active">Menus</span><span>Aperçu</span><span>Réglages</span></nav>
    </div>
  );
}

