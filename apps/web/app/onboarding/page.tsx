"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Brand } from "@/components/brand";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { slugify, validateSlug } from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

export default function OnboardingPage() {
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
    <ProtectedWorkspace mode="onboarding">
      <main className="onboarding-page">
        <div className="onboarding-card">
          <Brand />
          <span className="eyebrow">Première étape</span>
          <h1 className="serif">Créons votre établissement.</h1>
          <p className="muted">Vous pourrez tout modifier plus tard.</p>
          <form
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
                  onChange={(e) => changeName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="venue-kind">Type</label>
                <select
                  className="input"
                  id="venue-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
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
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="form-group span-2">
                <label htmlFor="venue-slug">Adresse du menu</label>
                <div className="slug-input">
                  <span>{`${publicHost}/`}</span>
                  <input
                    id="venue-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                    required
                  />
                </div>
                {slug && error ? (
                  <span className="form-error">{error}</span>
                ) : null}
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
              {pending ? "Création…" : "Créer mon menu"}
            </button>
          </form>
        </div>
      </main>
    </ProtectedWorkspace>
  );
}
