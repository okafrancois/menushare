"use client";

import {
  AlertTriangle,
  Ban,
  Minus,
  Play,
  Plus,
  ShieldAlert,
  Star,
  Wine,
} from "lucide-react";
import { useState } from "react";

import { AddButton, DietTags, DishBadges } from "@/components/menu/dish-row";
import { CloseButton, Sheet } from "@/components/menu/menu-sheet";
import { VideoFrame } from "@/components/menu/menu-video";
import { allergenConflicts, allergenLabel } from "@/lib/menu-filters";
import { formatPrice, type AllergenKey, type MenuItem } from "@/lib/menu-domain";

export type SheetDish = MenuItem & {
  /** Suggestion of the day: never tracked, allergens given by the staff. */
  isSpecial?: boolean;
};

export function DishSheet({
  item,
  popular,
  soldOut,
  avoid,
  quantity,
  pairingQuantity,
  onClose,
  onCommit,
  onAddPairing,
}: {
  item: SheetDish;
  popular: boolean;
  soldOut: boolean;
  avoid: AllergenKey[];
  quantity: number;
  pairingQuantity: number;
  onClose: () => void;
  onCommit: (quantity: number) => void;
  onAddPairing: () => void;
}) {
  const [count, setCount] = useState(Math.max(1, quantity));
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const slides = [
    ...item.images.map((image) => ({ kind: "image" as const, image })),
    ...(item.video ? [{ kind: "video" as const }] : []),
  ];
  const poster = item.images[0]?.dataUrl;
  const conflicts = allergenConflicts(item, avoid);
  const titleId = `dish-title-${item.id}`;

  return (
    <Sheet onClose={onClose} labelledBy={titleId} className="pm-dish-sheet">
      <div className="pm-dish-scroll">
        {slides.length ? (
          <div className="pm-media">
            <div
              className="pm-media-track"
              onScroll={(event) => {
                const track = event.currentTarget;
                setSlide(Math.round(track.scrollLeft / track.clientWidth));
              }}
            >
              {slides.map((entry, index) =>
                entry.kind === "image" ? (
                  <figure className="pm-slide" key={entry.image.id}>
                    <img src={entry.image.dataUrl} alt={entry.image.alt} />
                  </figure>
                ) : (
                  <figure className="pm-slide video" key="video">
                    {playing && item.video ? (
                      <VideoFrame
                        title={item.name}
                        video={item.video}
                        itemId={item.isSpecial ? undefined : item.id}
                        autoplay
                      />
                    ) : (
                      <button
                        className="pm-play"
                        type="button"
                        style={
                          poster
                            ? { backgroundImage: `url(${poster})` }
                            : undefined
                        }
                        onClick={() => setPlaying(true)}
                        aria-label={`Lire la vidéo de ${item.name}`}
                        data-slide={index}
                      >
                        <span className="pm-play-icon">
                          <Play size={26} fill="currentColor" />
                        </span>
                        <span>Regarder la vidéo</span>
                      </button>
                    )}
                  </figure>
                ),
              )}
            </div>
            <span className="pm-sheet-handle on-media" aria-hidden="true" />
            <CloseButton onClose={onClose} className="pm-close on-media" />
            {slides.length > 1 ? (
              <div className="pm-dots" aria-label="Galerie du plat">
                {slides.map((entry, index) => (
                  <button
                    key={index}
                    type="button"
                    className={index === slide ? "on" : ""}
                    aria-label={`Afficher le média ${index + 1}`}
                    aria-current={index === slide}
                    onClick={(event) => {
                      const track = event.currentTarget
                        .closest(".pm-media")
                        ?.querySelector(".pm-media-track");
                      track?.scrollTo({
                        left: index * (track.clientWidth || 0),
                        behavior: "smooth",
                      });
                      setSlide(index);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pm-sheet-bar">
            <span className="pm-sheet-handle" aria-hidden="true" />
            <CloseButton onClose={onClose} />
          </div>
        )}

        <div className="pm-dish-body">
          <DishBadges item={item} popular={popular} />
          <h2 id={titleId}>{item.name}</h2>
          <div className="pm-dish-price-row">
            {soldOut ? (
              <span className="pm-tag">
                <Ban size={12} /> Épuisé ce soir
              </span>
            ) : (
              <strong className="pm-dish-price">
                {formatPrice(item.priceCents)}
              </strong>
            )}
            <DietTags item={item} />
          </div>
          {item.details || item.description ? (
            <p className="pm-lead">{item.details || item.description}</p>
          ) : null}

          <section className="pm-block">
            <h3>
              <ShieldAlert size={15} /> Allergènes
            </h3>
            <div className={`pm-allergens ${conflicts.length ? "conflict" : ""}`}>
              {conflicts.length ? (
                <p className="pm-conflict" role="alert">
                  <AlertTriangle size={16} /> Contient{" "}
                  {conflicts.map((key) => allergenLabel(key).toLowerCase()).join(", ")}
                  , que vous évitez.
                </p>
              ) : null}
              {item.allergens === undefined ? (
                <p className="pm-allergen-note">
                  Non communiqués sur la carte : demandez au serveur.
                </p>
              ) : item.allergens.length ? (
                <ul>
                  {item.allergens.map((key) => (
                    <li
                      key={key}
                      className={avoid.includes(key) ? "hit" : ""}
                    >
                      {allergenLabel(key)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pm-allergen-note">
                  Aucun des 14 allergènes majeurs.
                </p>
              )}
              <small>Information fournie par l’établissement.</small>
            </div>
          </section>

          {item.ingredients.length ? (
            <section className="pm-block">
              <h3>Ingrédients</h3>
              <p className="pm-ingredients">{item.ingredients.join(" · ")}</p>
            </section>
          ) : null}

          {item.pairingName ? (
            <section className="pm-block">
              <h3>Accord conseillé</h3>
              <div className="pm-pairing">
                <span className="pm-pairing-icon">
                  <Wine size={19} />
                </span>
                <span>
                  <strong>{item.pairingName}</strong>
                  {item.pairingPriceCents !== undefined ? (
                    <span>{formatPrice(item.pairingPriceCents)}</span>
                  ) : null}
                </span>
                {item.pairingPriceCents !== undefined ? (
                  <AddButton
                    name={item.pairingName}
                    quantity={pairingQuantity}
                    onAdd={onAddPairing}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {item.reviewRating !== undefined || item.reviewQuote ? (
            <section className="pm-block">
              <h3>Avis clients</h3>
              <div className="pm-review">
                {item.reviewRating !== undefined ? (
                  <div className="pm-stars">
                    <span aria-hidden="true">
                      {Array.from({ length: 5 }, (_, star) => (
                        <Star
                          key={star}
                          size={15}
                          fill={
                            star < Math.round(item.reviewRating ?? 0)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      ))}
                    </span>
                    <strong>
                      {item.reviewRating.toLocaleString("fr-FR")}/5
                    </strong>
                    {item.reviewCount !== undefined ? (
                      <small>({item.reviewCount} avis)</small>
                    ) : null}
                  </div>
                ) : null}
                {item.reviewQuote ? (
                  <blockquote>“{item.reviewQuote}”</blockquote>
                ) : null}
                {item.reviewAuthor ? <cite>{item.reviewAuthor}</cite> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="pm-sheet-foot">
        {soldOut ? (
          <p className="pm-soldout-note">
            <Ban size={16} /> Victime de son succès : demandez une alternative
            au serveur.
          </p>
        ) : (
          <div className="pm-foot-row">
            <div className="pm-stepper" aria-label="Quantité">
              <button
                type="button"
                aria-label="Diminuer la quantité"
                onClick={() => setCount((value) => Math.max(1, value - 1))}
              >
                <Minus size={16} />
              </button>
              <output aria-live="polite">{count}</output>
              <button
                type="button"
                aria-label="Augmenter la quantité"
                onClick={() => setCount((value) => Math.min(20, value + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="pm-btn primary"
              type="button"
              onClick={() => onCommit(count)}
            >
              {quantity ? "Mettre à jour" : "Ajouter à ma sélection"} ·{" "}
              {formatPrice(item.priceCents * count)}
            </button>
          </div>
        )}
      </footer>
    </Sheet>
  );
}
