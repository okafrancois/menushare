"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { slugify, validateSlug } from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

export function VenueForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { createVenue } = useMenuStore();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState("Restaurant");
  const [city, setCity] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const error = validateSlug(slug);
  const publicHost = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://menushare.app"
  )
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  function changeName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <>
      {compact ? (
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Établissements</span>
            <h1 className="serif">Ajouter un établissement</h1>
            <p className="muted">
              Votre compte peut en gérer autant que nécessaire.
            </p>
          </div>
        </div>
      ) : (
        <>
          <span className="eyebrow">Première étape</span>
          <h1 className="serif">Créons votre établissement.</h1>
          <p className="muted">Vous pourrez tout modifier plus tard.</p>
        </>
      )}
      <form
        className={compact ? "venue-form-card" : undefined}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim() || error) return;
          setPending(true);
          setSubmitError("");
          try {
            await createVenue({ name, slug, kind, city });
            router.push("/dashboard/menu");
          } catch (cause) {
            setSubmitError(
              cause instanceof Error &&
                cause.message.includes("SLUG_UNAVAILABLE")
                ? "Cette adresse est déjà utilisée."
                : "Impossible de créer l’établissement. Réessayez.",
            );
            setPending(false);
          }
        }}
      >
        <div className="form-grid">
          <div className="form-group span-2">
            <label htmlFor="venue-name">Nom de l’établissement</label>
            <input
              className="input"
              id="venue-name"
              value={name}
              onChange={(event) => changeName(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="venue-kind">Type</label>
            <select
              className="input"
              id="venue-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option>Restaurant</option>
              <option>Traiteur</option>
              <option>Café</option>
              <option>Bar</option>
              <option>Food truck</option>
              <option>Hôtel</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="venue-city">Ville</label>
            <input
              className="input"
              id="venue-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="venue-slug">Adresse du menu</label>
            <div className="slug-input">
              <span>{`${publicHost}/menu/`}</span>
              <input
                id="venue-slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                required
              />
            </div>
            {slug && error ? <span className="form-error">{error}</span> : null}
          </div>
        </div>
        {submitError ? (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        ) : null}
        <button
          className="button button-primary button-block"
          type="submit"
          disabled={pending || !name.trim() || Boolean(error)}
        >
          {pending
            ? "Création…"
            : compact
              ? "Créer cet établissement"
              : "Créer mon menu"}
        </button>
      </form>
    </>
  );
}
