import { MapPin, Phone, Play } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { demoVenue, formatPrice } from "@/lib/demo-menu";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== demoVenue.slug) return {};
  return {
    title: demoVenue.name,
    description: demoVenue.tagline,
  };
}

export default async function PublicMenuPage({ params }: PageProps) {
  const { slug } = await params;
  if (slug !== demoVenue.slug) notFound();

  return (
    <main className="public-menu">
      <header className="public-hero">
        <div className="public-hero-content">
          <span className="eyebrow" style={{ color: "#f2d1b2" }}>{demoVenue.kind} · {demoVenue.city}</span>
          <h1 className="serif">{demoVenue.name}</h1>
          <p>{demoVenue.description}</p>
          <div className="public-meta"><span><MapPin size={15} /> Bordeaux, Gironde</span><span>{demoVenue.hours}</span><span><Phone size={15} /> {demoVenue.phone}</span></div>
        </div>
        <span className="play-button" style={{ top: "28%" }} aria-label="Lire la vidéo de couverture"><Play fill="currentColor" size={22} /></span>
      </header>

      <nav className="public-nav" aria-label="Catégories du menu">
        <div className="public-nav-inner">{demoVenue.categories.map((category) => <a href={`#${category.id}`} key={category.id}>{category.name}</a>)}</div>
      </nav>

      <div className="public-content">
        {demoVenue.categories.map((category) => (
          <section className="menu-category" id={category.id} key={category.id}>
            <header className="menu-category-header"><span className="eyebrow">{category.eyebrow}</span><h2 className="serif">{category.name}</h2></header>
            {category.items.map((item) => (
              <article className="public-item" key={item.id}>
                <div><h3>{item.name}</h3><p>{item.description}</p><span className="public-item-price">{formatPrice(item.priceCents)}</span></div>
                <div className={`public-item-art${item.video ? " video" : ""}`} aria-label={item.video ? `Vidéo ${item.video.provider}` : "Image du plat"} />
              </article>
            ))}
          </section>
        ))}
      </div>
      <footer className="public-footer">{demoVenue.name} · Menu propulsé par MenuShare</footer>
    </main>
  );
}

