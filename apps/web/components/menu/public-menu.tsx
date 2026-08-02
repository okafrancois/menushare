"use client";

import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Play,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

import {
  formatPrice,
  type ExternalVideo,
  type MenuItem,
  type MenuSnapshot,
} from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

export function PublicMenu({ slug }: { slug: string }) {
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
          <p>{venue.description}</p>
          <div className="public-meta">
            {venue.address || venue.city ? (
              <span>
                <MapPin size={15} /> {venue.address || venue.city}
              </span>
            ) : null}
            {venue.hours ? <span>{venue.hours}</span> : null}
            {venue.phone ? (
              <span>
                <Phone size={15} /> {venue.phone}
              </span>
            ) : null}
          </div>
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
              {category.items.map((item) => (
                <button
                  className="public-item"
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  aria-label={`Voir ${item.name}`}
                >
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <span className="public-item-price">
                      {formatPrice(item.priceCents)}
                    </span>
                  </div>
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
                </button>
              ))}
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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const mediaCount = item.images.length + (item.video ? 1 : 0);
  const showingVideo = Boolean(item.video && index === item.images.length);
  useEffect(() => setVideoLoaded(false), [index]);
  return (
    <div
      className="modal-backdrop public-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="public-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-item-title"
      >
        <button
          className="modal-close-light"
          type="button"
          aria-label="Fermer"
          onClick={onClose}
        >
          <X />
        </button>
        <div className="public-modal-media">
          {showingVideo && item.video ? (
            videoLoaded ? (
              <VideoFrame title={item.name} video={item.video} />
            ) : (
              <button
                className="video-consent"
                type="button"
                onClick={() => setVideoLoaded(true)}
              >
                <Play fill="currentColor" />
                <strong>
                  Lire sur{" "}
                  {item.video.provider === "youtube" ? "YouTube" : "Vimeo"}
                </strong>
                <span>
                  Le lecteur externe ne se charge qu’après votre clic.
                </span>
              </button>
            )
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
        </div>
        <div className="public-modal-copy">
          <span className="eyebrow">À la carte</span>
          <h2 className="serif" id="public-item-title">
            {item.name}
          </h2>
          <p>{item.description}</p>
          <strong>{formatPrice(item.priceCents)}</strong>
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
  const [loaded, setLoaded] = useState(false);
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
        {loaded ? (
          <VideoFrame title={title} video={video} />
        ) : (
          <button
            className="video-consent"
            type="button"
            onClick={() => setLoaded(true)}
          >
            <Play fill="currentColor" />
            <strong>
              Lire sur {video.provider === "youtube" ? "YouTube" : "Vimeo"}
            </strong>
            <span>Le lecteur externe ne se charge qu’après votre clic.</span>
          </button>
        )}
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
