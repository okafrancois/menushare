"use client";

import { Play } from "lucide-react";

import type { MenuCategory, Venue } from "@/lib/menu-domain";
import { formatPrice } from "@/lib/menu-domain";

export function MenuPhonePreview({
  venue,
  categories,
}: {
  venue: Venue;
  categories: MenuCategory[];
}) {
  const items = categories.flatMap((category) => category.items).slice(0, 2);
  const heroStyle = venue.coverImageDataUrl
    ? {
        backgroundImage: `linear-gradient(rgba(30,20,18,.15),rgba(45,18,27,.55)), url(${venue.coverImageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(145deg, ${venue.accentColor}aa, ${venue.accentColor})`,
      };

  return (
    <div className="phone" aria-label="Aperçu mobile du menu">
      <div className="phone-hero" style={heroStyle}>
        {venue.coverVideo ? (
          <span className="play-button">
            <Play fill="currentColor" size={22} />
          </span>
        ) : null}
      </div>
      <div className="phone-body">
        <span className="eyebrow" style={{ color: venue.accentColor }}>
          {venue.kind} · {venue.city}
        </span>
        <h2 className="serif">{venue.name}</h2>
        <p>{venue.tagline}</p>
        <div className="chips">
          {categories.map((category) => (
            <span className="chip" key={category.id}>
              {category.name}
            </span>
          ))}
        </div>
        {items.map((item) => (
          <div className="mini-item" key={item.id}>
            <span
              className="mini-item-art"
              style={
                item.images[0]
                  ? {
                      backgroundImage: `url(${item.images[0].dataUrl})`,
                      backgroundSize: "cover",
                    }
                  : undefined
              }
            />
            <strong>{item.name}</strong>
            <span style={{ color: venue.accentColor }}>
              {formatPrice(item.priceCents)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
