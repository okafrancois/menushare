"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Phone,
  Play,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@repo/backend/api";
import { useQuery } from "convex/react";

import {
  formatPrice,
  createDemoState,
  type ExternalVideo,
  type MenuItem,
  type MenuSnapshot,
} from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";
import { convex } from "@/lib/convex";

export function PublicMenu({ slug }: { slug: string }) {
  if (convex) return <RemotePublicMenu slug={slug} />;
  return <LocalPublicMenu slug={slug} />;
}

function LocalPublicMenu({ slug }: { slug: string }) {
  const { state, hydrated } = useMenuStore();
  const snapshot =
    state.published?.venue.slug === slug ? state.published : undefined;

  if (!hydrated)
    return <main className="public-loading">Chargement du menu…</main>;
  if (!snapshot)
    return (
      <main className="public-not-found">
        <span className="eyebrow">Menu indisponible</span>
        <h1 className="serif">Cette table est encore vide.</h1>
        <p>Ce menu n’existe pas ou n’a pas encore été publié.</p>
        <Link className="button button-primary" href="/">
          Retour à MenuShare
        </Link>
      </main>
    );
  return <PublishedMenu snapshot={snapshot} />;
}

type PublishedPayload = {
  venue: {
    _id: string;
    slug: string;
    name: string;
    kind: string;
    city?: string;
    tagline?: string;
    description?: string;
    address?: string;
    phone?: string;
    hours?: string;
    accentColor?: string;
    logoUrl?: string | null;
    coverImageUrl?: string | null;
    coverVideoProvider?: "youtube" | "vimeo";
    coverVideoExternalId?: string;
    coverVideoEmbedUrl?: string;
  };
  menu: { version: number; publishedAt?: number };
  categories: Array<{
    _id: string;
    name: string;
    eyebrow?: string;
    items: Array<{
      _id: string;
      name: string;
      description?: string;
      details?: string;
      priceCents: number;
      active: boolean;
      ingredients?: string[];
      pairingName?: string;
      pairingPriceCents?: number;
      reviewRating?: number;
      reviewCount?: number;
      reviewQuote?: string;
      reviewAuthor?: string;
      media: Array<{
        _id: string;
        kind: "image" | "externalVideo";
        imageUrl?: string | null;
        alt?: string;
        provider?: "youtube" | "vimeo";
        externalId?: string;
        embedUrl?: string;
      }>;
    }>;
  }>;
};

function toPublicSnapshot(value: unknown): MenuSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PublishedPayload>;
  if (
    !candidate.venue ||
    !candidate.menu ||
    !Array.isArray(candidate.categories)
  ) {
    return null;
  }
  const rawVenue = candidate.venue;
  if (!rawVenue._id || !rawVenue.slug || !rawVenue.name) return null;
  const venue = {
    id: rawVenue._id,
    slug: rawVenue.slug,
    name: rawVenue.name,
    kind: rawVenue.kind || "Restaurant",
    city: rawVenue.city ?? "",
    tagline: rawVenue.tagline ?? "",
    description: rawVenue.description ?? "",
    address: rawVenue.address ?? "",
    phone: rawVenue.phone ?? "",
    hours: rawVenue.hours ?? "",
    accentColor: rawVenue.accentColor ?? "#76263c",
    logoDataUrl: rawVenue.logoUrl ?? undefined,
    coverImageDataUrl: rawVenue.coverImageUrl ?? undefined,
    coverVideo:
      rawVenue.coverVideoProvider &&
      rawVenue.coverVideoExternalId &&
      rawVenue.coverVideoEmbedUrl
        ? {
            provider: rawVenue.coverVideoProvider,
            externalId: rawVenue.coverVideoExternalId,
            embedUrl: rawVenue.coverVideoEmbedUrl,
          }
        : undefined,
  };
  const categories = candidate.categories.map((category) => ({
    id: category._id,
    name: category.name,
    eyebrow: category.eyebrow ?? "",
    items: category.items.map((item) => {
      const video = item.media.find(
        (asset) =>
          asset.kind === "externalVideo" &&
          asset.provider &&
          asset.externalId &&
          asset.embedUrl,
      );
      return {
        id: item._id,
        name: item.name,
        description: item.description ?? "",
        details: item.details ?? "",
        priceCents: item.priceCents,
        available: item.active,
        images: item.media
          .filter((asset) => asset.kind === "image" && asset.imageUrl)
          .map((asset) => ({
            id: asset._id,
            dataUrl: asset.imageUrl!,
            alt: asset.alt ?? item.name,
          })),
        video:
          video?.provider && video.externalId && video.embedUrl
            ? {
                provider: video.provider,
                externalId: video.externalId,
                embedUrl: video.embedUrl,
              }
            : undefined,
        ingredients: item.ingredients ?? [],
        pairingName: item.pairingName ?? "",
        pairingPriceCents: item.pairingPriceCents,
        reviewRating: item.reviewRating,
        reviewCount: item.reviewCount,
        reviewQuote: item.reviewQuote ?? "",
        reviewAuthor: item.reviewAuthor ?? "",
      };
    }),
  }));
  return {
    venue,
    categories,
    publishedAt: candidate.menu.publishedAt ?? Date.now(),
    version: candidate.menu.version,
  };
}

function RemotePublicMenu({ slug }: { slug: string }) {
  const result: unknown = useQuery(api.menus.getPublishedBySlug, { slug });
  if (result === undefined) {
    return <main className="public-loading">Chargement du menu…</main>;
  }
  const snapshot = toPublicSnapshot(result);
  if (!snapshot) {
    if (slug === "nonna-lydie") {
      return <PublishedMenu snapshot={createDemoState().published!} />;
    }
    return (
      <main className="public-not-found">
        <span className="eyebrow">Menu indisponible</span>
        <h1 className="serif">Cette table est encore vide.</h1>
        <p>Ce menu n’existe pas ou n’a pas encore été publié.</p>
        <Link className="button button-primary" href="/">
          Retour à MenuShare
        </Link>
      </main>
    );
  }
  return <PublishedMenu snapshot={snapshot} />;
}

function PublishedMenu({ snapshot }: { snapshot: MenuSnapshot }) {
  const { venue, categories } = snapshot;
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [coverVideoOpen, setCoverVideoOpen] = useState(false);
  const availableCategories = categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => item.available),
    }))
    .filter((category) => category.items.length);
  const style = { "--accent": venue.accentColor } as CSSProperties;
  const heroStyle = venue.coverImageDataUrl
    ? {
        backgroundImage: `linear-gradient(rgba(25,18,18,.28),rgba(43,20,28,.72)), url(${venue.coverImageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <main className="public-menu" style={style}>
      <header className="public-hero" style={heroStyle}>
        <div className="public-hero-content">
          {venue.logoDataUrl ? (
            <img
              className="public-logo"
              src={venue.logoDataUrl}
              alt={`Logo ${venue.name}`}
            />
          ) : null}
          <span className="eyebrow public-eyebrow">
            {venue.kind} · {venue.city}
          </span>
          <h1 className="serif">{venue.name}</h1>
          {venue.tagline ? (
            <p className="public-tagline">{venue.tagline}</p>
          ) : null}
        </div>
        {venue.coverVideo ? (
          <button
            className="play-button cover-play"
            type="button"
            aria-label="Lire la vidéo de couverture"
            onClick={() => setCoverVideoOpen(true)}
          >
            <Play fill="currentColor" size={22} />
          </button>
        ) : null}
      </header>
      <div className="public-page-body">
        {venue.description ||
        venue.address ||
        venue.city ||
        venue.hours ||
        venue.phone ? (
          <section
            className="public-venue-card"
            aria-label="Informations de l’établissement"
          >
            {venue.description ? (
              <p className="public-description">{venue.description}</p>
            ) : null}
            {venue.address || venue.city || venue.hours || venue.phone ? (
              <ul className="public-meta">
                {venue.address || venue.city ? (
                  <li>
                    <MapPin size={16} />{" "}
                    <span>{venue.address || venue.city}</span>
                  </li>
                ) : null}
                {venue.hours ? (
                  <li>
                    <Clock3 size={16} /> <span>{venue.hours}</span>
                  </li>
                ) : null}
                {venue.phone ? (
                  <li>
                    <Phone size={16} />
                    <a href={`tel:${venue.phone.replace(/\s/g, "")}`}>
                      {venue.phone}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </section>
        ) : null}
        <nav className="public-nav" aria-label="Catégories du menu">
          <div className="public-nav-inner">
            {availableCategories.map((category) => (
              <a href={`#${category.id}`} key={category.id}>
                {category.name}
              </a>
            ))}
          </div>
        </nav>
        <div className="public-content">
          {availableCategories.length ? (
            availableCategories.map((category) => (
              <section
                className="menu-category"
                id={category.id}
                key={category.id}
              >
                <header className="menu-category-header">
                  <span className="eyebrow">{category.eyebrow}</span>
                  <h2 className="serif">{category.name}</h2>
                </header>
                <div className="public-items-grid">
                  {category.items.map((item) => (
                    <button
                      className="public-item"
                      key={item.id}
                      type="button"
                      onClick={() => setSelected(item)}
                      aria-label={`Voir ${item.name}`}
                    >
                      <div
                        className={`public-item-art${item.video ? " video" : ""}`}
                        style={
                          item.images[0]
                            ? {
                                backgroundImage: `url(${item.images[0].dataUrl})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                        aria-label={
                          item.video
                            ? `Vidéo ${item.video.provider}`
                            : item.images.length
                              ? "Image du plat"
                              : "Illustration du plat"
                        }
                      />
                      <div className="public-item-copy">
                        <div>
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                        </div>
                        <span className="public-item-price">
                          {formatPrice(item.priceCents)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="empty-state">
              <h2 className="serif">Le menu arrive bientôt.</h2>
            </div>
          )}
        </div>
        <footer className="public-footer">
          {venue.name} · Menu propulsé par MenuShare
        </footer>
      </div>
      {selected ? (
        <ItemMediaModal item={selected} onClose={() => setSelected(null)} />
      ) : null}
      {coverVideoOpen && venue.coverVideo ? (
        <VideoModal
          title={`L’histoire de ${venue.name}`}
          video={venue.coverVideo}
          onClose={() => setCoverVideoOpen(false)}
        />
      ) : null}
    </main>
  );
}

function ItemMediaModal({
  item,
  onClose,
}: {
  item: MenuItem;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const mediaCount = item.images.length + (item.video ? 1 : 0);
  const showingVideo = Boolean(item.video && index === item.images.length);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
  return (
    <div
      className="dish-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="dish-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-item-title"
      >
        <button
          className="dish-sheet-close"
          type="button"
          aria-label="Fermer"
          onClick={onClose}
        >
          <X />
        </button>
        <div className="dish-sheet-media">
          {showingVideo ? <span className="dish-media-type">Vidéo</span> : null}
          {showingVideo && item.video ? (
            <VideoFrame title={item.name} video={item.video} />
          ) : item.images[index] ? (
            <img
              src={item.images[index].dataUrl}
              alt={item.images[index].alt}
            />
          ) : (
            <div className="media-placeholder">
              {item.video ? <Play size={46} /> : <span>✦</span>}
            </div>
          )}
          {mediaCount > 1 ? (
            <>
              <button
                className="gallery-arrow left"
                aria-label="Média précédent"
                onClick={() => setIndex((index - 1 + mediaCount) % mediaCount)}
              >
                <ChevronLeft />
              </button>
              <button
                className="gallery-arrow right"
                aria-label="Média suivant"
                onClick={() => setIndex((index + 1) % mediaCount)}
              >
                <ChevronRight />
              </button>
            </>
          ) : null}
          {mediaCount ? (
            <div className="dish-media-dots" aria-label="Galerie du plat">
              {Array.from({ length: mediaCount }, (_, mediaIndex) => (
                <button
                  key={mediaIndex}
                  type="button"
                  className={mediaIndex === index ? "active" : ""}
                  aria-label={`Afficher le média ${mediaIndex + 1}`}
                  onClick={() => setIndex(mediaIndex)}
                />
              ))}
            </div>
          ) : null}
          <div className="dish-media-title">
            <h2 className="serif" id="public-item-title">
              {item.name}
            </h2>
            <strong>{formatPrice(item.priceCents)}</strong>
          </div>
        </div>
        <div className="dish-sheet-copy">
          <p className="dish-lead">{item.details || item.description}</p>
          {item.ingredients.length ? (
            <section className="dish-detail-section">
              <h3>Ingrédients</h3>
              <ul className="dish-ingredients">
                {item.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {item.pairingName ? (
            <section className="dish-detail-section dish-pairing">
              <div>
                <span className="eyebrow">Suggestion de la maison</span>
                <h3>Accord mets & vins</h3>
                <p>{item.pairingName}</p>
              </div>
              {item.pairingPriceCents !== undefined ? (
                <strong>{formatPrice(item.pairingPriceCents)}</strong>
              ) : null}
            </section>
          ) : null}
          {item.reviewRating !== undefined || item.reviewQuote ? (
            <section className="dish-detail-section dish-reviews">
              <h3>Avis clients</h3>
              <div className="dish-rating">
                <span className="dish-stars" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, star) => (
                    <Star
                      key={star}
                      size={17}
                      fill={
                        star < Math.round(item.reviewRating ?? 0)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ))}
                </span>
                <strong>
                  {item.reviewRating?.toLocaleString("fr-FR") ?? "—"}/5
                </strong>
                {item.reviewCount !== undefined ? (
                  <small>({item.reviewCount} avis)</small>
                ) : null}
              </div>
              {item.reviewQuote ? (
                <blockquote>“{item.reviewQuote}”</blockquote>
              ) : null}
              {item.reviewAuthor ? <cite>{item.reviewAuthor}</cite> : null}
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function VideoModal({
  title,
  video,
  onClose,
}: {
  title: string;
  video: ExternalVideo;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop public-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="video-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button
          className="modal-close-light"
          aria-label="Fermer"
          onClick={onClose}
        >
          <X />
        </button>
        <VideoFrame title={title} video={video} />
      </section>
    </div>
  );
}

function VideoFrame({ title, video }: { title: string; video: ExternalVideo }) {
  return (
    <iframe
      data-testid="video-frame"
      src={video.embedUrl}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}
