"use client";

import { ALLERGENS } from "@repo/backend/menu";
import {
  Check,
  Clock3,
  Info,
  Leaf,
  Maximize2,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Play,
  Plus,
  Search,
  Share2,
} from "lucide-react";
import { useState } from "react";

import { DishRow } from "@/components/menu/dish-row";
import { CloseButton, Sheet, SheetHeader } from "@/components/menu/menu-sheet";
import { formatPrice, type MenuCategory, type Venue } from "@/lib/menu-domain";
import {
  isHiddenByFilter,
  matchesSearch,
  toggleAvoid,
  type DietFilter,
} from "@/lib/menu-filters";
import { weekSchedule, parisTime } from "@/lib/opening-hours";

export type SelectionLine = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
};

export function SelectionSheet({
  lines,
  totalCents,
  onClose,
  onChange,
  onShowWaiter,
  onShare,
}: {
  lines: SelectionLine[];
  totalCents: number;
  onClose: () => void;
  onChange: (id: string, quantity: number) => void;
  onShowWaiter: () => void;
  onShare: () => void;
}) {
  return (
    <Sheet onClose={onClose} labelledBy="selection-title">
      <SheetHeader id="selection-title" title="Ma sélection" onClose={onClose} />
      <div className="pm-sheet-body">
        {lines.length ? (
          <>
            <p className="pm-hint">
              <Info size={16} />
              <span>
                Votre pense-bête pour la table : rien n’est envoyé en cuisine.
                Montrez-le au serveur au moment de commander.
              </span>
            </p>
            <ul className="pm-selection">
              {lines.map((line) => (
                <li key={line.id}>
                  <div>
                    <strong>{line.name}</strong>
                    <span>
                      {formatPrice(line.priceCents)}
                      {line.quantity > 1
                        ? ` · ${formatPrice(line.priceCents * line.quantity)}`
                        : ""}
                    </span>
                  </div>
                  <div className="pm-stepper small">
                    <button
                      type="button"
                      aria-label={`Retirer un ${line.name}`}
                      onClick={() => onChange(line.id, line.quantity - 1)}
                    >
                      <Minus size={15} />
                    </button>
                    <output>{line.quantity}</output>
                    <button
                      type="button"
                      aria-label={`Ajouter un ${line.name}`}
                      onClick={() => onChange(line.id, line.quantity + 1)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="pm-total">
              <span>Total estimé</span>
              <strong>{formatPrice(totalCents)}</strong>
            </p>
          </>
        ) : (
          <p className="pm-empty">
            Touchez <b>+</b> sur un plat pour le garder ici.
          </p>
        )}
      </div>
      {lines.length ? (
        <footer className="pm-sheet-foot">
          <div className="pm-foot-row">
            <button className="pm-btn ghost" type="button" onClick={onShare}>
              <Share2 size={16} /> Partager
            </button>
            <button
              className="pm-btn primary"
              type="button"
              onClick={onShowWaiter}
            >
              <Maximize2 size={16} /> Montrer au serveur
            </button>
          </div>
        </footer>
      ) : null}
    </Sheet>
  );
}

export function WaiterView({
  table,
  lines,
  onClose,
}: {
  table?: number;
  lines: SelectionLine[];
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} label="Sélection pour le serveur" variant="night">
      <div className="pm-waiter">
        <div className="pm-waiter-head">
          <span>{table ? `Table ${table}` : "Ma sélection"}</span>
          <CloseButton onClose={onClose} className="pm-close on-media" />
        </div>
        <ul>
          {lines.map((line) => (
            <li key={line.id}>
              <b>{line.quantity}×</b>
              <span>{line.name}</span>
            </li>
          ))}
        </ul>
        <p>Écran agrandi pour le serveur. Rien n’a encore été commandé.</p>
      </div>
    </Sheet>
  );
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function telUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function directionsUrl(venue: Venue) {
  const query = [venue.address, venue.city].filter(Boolean).join(", ");
  return query ? mapsUrl(query) : null;
}

const updatedFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function InfoSheet({
  venue,
  publishedAt,
  now,
  onClose,
  onPlayStory,
}: {
  venue: Venue;
  publishedAt: number;
  now: number | null;
  onClose: () => void;
  onPlayStory: () => void;
}) {
  const today = now === null ? -1 : parisTime(now).day;
  const hasHours = venue.openingHours?.some((day) => day.ranges.length);
  const directions = directionsUrl(venue);
  return (
    <Sheet onClose={onClose} labelledBy="info-title">
      <SheetHeader id="info-title" title={venue.name} onClose={onClose}>
        <span className="pm-sheet-sub">
          {[venue.kind, venue.city].filter(Boolean).join(" · ")}
        </span>
      </SheetHeader>
      <div className="pm-sheet-body">
        {venue.coverVideo ? (
          <button
            className="pm-story"
            type="button"
            onClick={onPlayStory}
            style={
              venue.coverImageDataUrl
                ? { backgroundImage: `url(${venue.coverImageDataUrl})` }
                : undefined
            }
          >
            <span className="pm-play-icon">
              <Play size={22} fill="currentColor" />
            </span>
            <span>Notre histoire en vidéo</span>
          </button>
        ) : null}
        {venue.tagline ? <p className="pm-info-tagline">{venue.tagline}</p> : null}
        {venue.description ? (
          <p className="pm-info-text">{venue.description}</p>
        ) : null}
        {hasHours ? (
          <section className="pm-block">
            <h3>
              <Clock3 size={15} /> Horaires
            </h3>
            <ul className="pm-hours">
              {weekSchedule(venue.openingHours).map((row) => (
                <li
                  key={row.day}
                  className={row.day === today ? "today" : ""}
                >
                  <span>
                    {row.name}
                    {row.day === today ? " · aujourd’hui" : ""}
                  </span>
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>
            {venue.hours ? <p className="pm-info-text">{venue.hours}</p> : null}
          </section>
        ) : venue.hours ? (
          <section className="pm-block">
            <h3>
              <Clock3 size={15} /> Horaires
            </h3>
            <p className="pm-info-text">{venue.hours}</p>
          </section>
        ) : null}
        {venue.address || venue.city || venue.phone ? (
          <section className="pm-block pm-contact">
            {venue.address || venue.city ? (
              <div className="pm-contact-row">
                <MapPin size={18} />
                <span>{[venue.address, venue.city].filter(Boolean).join(", ")}</span>
                {directions ? (
                  <a
                    className="pm-btn line small"
                    href={directions}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation size={14} /> Itinéraire
                  </a>
                ) : null}
              </div>
            ) : null}
            {venue.phone ? (
              <div className="pm-contact-row">
                <Phone size={18} />
                <span>{venue.phone}</span>
                <a className="pm-btn line small" href={telUrl(venue.phone)}>
                  Appeler
                </a>
              </div>
            ) : null}
          </section>
        ) : null}
        <p className="pm-updated">
          Carte mise à jour le {updatedFormat.format(new Date(publishedAt))}.
        </p>
      </div>
    </Sheet>
  );
}

export function AllergenSheet({
  filter,
  visibleCount,
  onChange,
  onClose,
}: {
  filter: DietFilter;
  visibleCount: number;
  onChange: (filter: DietFilter) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} labelledBy="allergens-title">
      <SheetHeader
        id="allergens-title"
        title="Allergies et régimes"
        onClose={onClose}
      />
      <div className="pm-sheet-body">
        <p className="pm-sheet-intro">
          Indiquez ce que vous évitez : les plats concernés sont masqués de la
          carte.
        </p>
        <div className="pm-options">
          <OptionToggle
            label="Végétarien"
            pressed={filter.vegetarian}
            tone="good"
            icon={<Leaf size={15} />}
            onClick={() =>
              onChange({ ...filter, vegetarian: !filter.vegetarian })
            }
          />
        </div>
        <h3 className="pm-group-title">J’évite</h3>
        <div className="pm-options">
          {ALLERGENS.map((allergen) => (
            <OptionToggle
              key={allergen.key}
              label={allergen.label}
              pressed={filter.avoid.includes(allergen.key)}
              onClick={() => onChange(toggleAvoid(filter, allergen.key))}
            />
          ))}
        </div>
        <p className="pm-disclaimer">
          Informations fournies par l’établissement. Les plats dont les
          allergènes ne sont pas renseignés sont masqués. En cas d’allergie
          sévère, prévenez le serveur.
        </p>
      </div>
      <footer className="pm-sheet-foot">
        <div className="pm-foot-row">
          <button
            className="pm-btn ghost"
            type="button"
            onClick={() => onChange({ vegetarian: false, avoid: [] })}
          >
            Effacer
          </button>
          <button className="pm-btn dark" type="button" onClick={onClose}>
            Voir {visibleCount} plat{visibleCount > 1 ? "s" : ""}
          </button>
        </div>
      </footer>
    </Sheet>
  );
}

function OptionToggle({
  label,
  pressed,
  onClick,
  tone = "danger",
  icon,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  tone?: "danger" | "good";
  icon?: React.ReactNode;
}) {
  return (
    <button
      className={`pm-option ${tone}`}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span>
        {icon}
        {label}
      </span>
      <span className="pm-check" aria-hidden="true">
        <Check size={13} />
      </span>
    </button>
  );
}

const SUGGESTIONS = ["Végétarien", "Fait maison", "Épicé", "Nouveau"];

export function SearchSheet({
  categories,
  soldOutIds,
  popularIds,
  quantities,
  filter,
  onClose,
  onOpen,
  onAdd,
}: {
  categories: MenuCategory[];
  soldOutIds: Set<string>;
  popularIds: Set<string>;
  quantities: Record<string, number>;
  filter: DietFilter;
  onClose: () => void;
  onOpen: (id: string) => void;
  onAdd: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? categories.flatMap((category) =>
        category.items
          .filter((item) => matchesSearch(item, query, category.name))
          .map((item) => ({ item, hidden: isHiddenByFilter(item, filter) })),
      )
    : [];
  return (
    <Sheet onClose={onClose} label="Rechercher un plat" variant="full">
      <div className="pm-search-head">
        <label className="pm-search-field">
          <Search size={17} />
          <span className="sr-only">Rechercher un plat</span>
          <input
            type="search"
            placeholder="Un plat, un ingrédient…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            data-autofocus
          />
        </label>
        <button className="pm-text-btn" type="button" onClick={onClose}>
          Annuler
        </button>
      </div>
      <div className="pm-sheet-body">
        {query.trim() ? (
          results.length ? (
            <>
              <p className="pm-group-title">
                {results.length} résultat{results.length > 1 ? "s" : ""}
              </p>
              {results.map(({ item, hidden }) => (
                <div key={item.id} className={hidden ? "pm-filtered" : ""}>
                  <DishRow
                    item={item}
                    popular={popularIds.has(item.id)}
                    soldOut={soldOutIds.has(item.id)}
                    quantity={quantities[item.id] ?? 0}
                    onOpen={() => onOpen(item.id)}
                    onAdd={() => onAdd(item.id)}
                  />
                  {hidden ? (
                    <p className="pm-filtered-note">
                      Ne correspond pas à vos filtres.
                    </p>
                  ) : null}
                </div>
              ))}
            </>
          ) : (
            <p className="pm-empty">Aucun plat ne correspond à « {query} ».</p>
          )
        ) : (
          <div className="pm-suggestions">
            {SUGGESTIONS.map((word) => (
              <button
                key={word}
                type="button"
                className="pm-chip"
                onClick={() => setQuery(word)}
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
