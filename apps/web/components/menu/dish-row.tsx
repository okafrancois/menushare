"use client";

import {
  Ban,
  Flame,
  Heart,
  Leaf,
  Play,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { formatPrice, type MenuItem } from "@/lib/menu-domain";

export function AddButton({
  name,
  quantity,
  onAdd,
  className = "",
}: {
  name: string;
  quantity: number;
  onAdd: () => void;
  className?: string;
}) {
  return (
    <button
      className={`pm-add ${quantity ? "has" : ""} ${className}`}
      type="button"
      aria-label={
        quantity
          ? `Ajouter encore ${name} (${quantity} dans ma sélection)`
          : `Ajouter ${name} à ma sélection`
      }
      onClick={(event) => {
        event.stopPropagation();
        onAdd();
      }}
    >
      {quantity ? <span>{quantity}</span> : <Plus size={17} />}
    </button>
  );
}

export function DishBadges({
  item,
  popular,
}: {
  item: Pick<MenuItem, "tags">;
  popular: boolean;
}) {
  const badges = [
    popular ? (
      <span className="pm-badge" key="popular">
        <TrendingUp size={13} /> Populaire
      </span>
    ) : null,
    item.tags.includes("signature") ? (
      <span className="pm-badge" key="signature">
        <Sparkles size={13} /> Signature du chef
      </span>
    ) : null,
    item.tags.includes("nouveau") ? (
      <span className="pm-badge new" key="new">
        <Sparkles size={13} /> Nouveau
      </span>
    ) : null,
    item.tags.includes("fait-maison") ? (
      <span className="pm-badge" key="homemade">
        <Heart size={13} /> Fait maison
      </span>
    ) : null,
  ].filter(Boolean);
  return badges.length ? <span className="pm-badges">{badges}</span> : null;
}

export function DietTags({ item }: { item: Pick<MenuItem, "tags"> }) {
  return (
    <>
      {item.tags.includes("vegan") ? (
        <span className="pm-tag veg">
          <Leaf size={12} /> Vegan
        </span>
      ) : item.tags.includes("vegetarien") ? (
        <span className="pm-tag veg">
          <Leaf size={12} /> Végétarien
        </span>
      ) : null}
      {item.tags.includes("epice") ? (
        <span className="pm-tag hot">
          <Flame size={12} /> Épicé
        </span>
      ) : null}
    </>
  );
}

export function DishRow({
  item,
  popular,
  soldOut,
  quantity,
  onOpen,
  onAdd,
}: {
  item: MenuItem;
  popular: boolean;
  soldOut: boolean;
  quantity: number;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const image = item.images[0];
  return (
    <article
      className={`pm-dish ${image ? "with-photo" : "text-only"} ${soldOut ? "sold-out" : ""}`}
    >
      <button
        className="pm-dish-open"
        type="button"
        aria-label={`Voir ${item.name}`}
        onClick={onOpen}
      >
        <span className="pm-dish-copy">
          <DishBadges item={item} popular={popular} />
          <h3>{item.name}</h3>
          {item.description ? <p>{item.description}</p> : null}
          <span className="pm-dish-meta">
            {soldOut ? (
              <span className="pm-tag">
                <Ban size={12} /> Épuisé
              </span>
            ) : (
              <span className="pm-price">{formatPrice(item.priceCents)}</span>
            )}
            <DietTags item={item} />
          </span>
        </span>
        {image ? (
          <span className="pm-thumb">
            <img src={image.dataUrl} alt="" loading="lazy" />
            {item.video ? (
              <span className="pm-thumb-video">
                <Play size={11} fill="currentColor" /> Vidéo
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      {soldOut ? null : (
        <AddButton
          name={item.name}
          quantity={quantity}
          onAdd={onAdd}
          className={image ? "on-photo" : "inline"}
        />
      )}
    </article>
  );
}
