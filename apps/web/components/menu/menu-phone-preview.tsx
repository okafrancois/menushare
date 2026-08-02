import { Play } from "lucide-react";

import { demoVenue, formatPrice } from "@/lib/demo-menu";

export function MenuPhonePreview() {
  const items = demoVenue.categories.flatMap((category) => category.items).slice(0, 2);

  return (
    <div className="phone" aria-label="Aperçu mobile du menu">
      <div className="phone-hero">
        <span className="play-button"><Play fill="currentColor" size={22} /></span>
      </div>
      <div className="phone-body">
        <span className="eyebrow">{demoVenue.kind} · {demoVenue.city}</span>
        <h2 className="serif">{demoVenue.name}</h2>
        <p>{demoVenue.tagline}</p>
        <div className="chips">
          {demoVenue.categories.map((category) => <span className="chip" key={category.id}>{category.name}</span>)}
        </div>
        {items.map((item) => (
          <div className="mini-item" key={item.id}>
            <span className="mini-item-art" />
            <strong>{item.name}</strong>
            <span>{formatPrice(item.priceCents)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

