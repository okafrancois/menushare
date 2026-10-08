"use client";

import { normalizeExternalVideoUrl } from "@repo/backend/video";
import { ImagePlus, PlayCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { errorMessage, PageHead, useToast } from "@/components/dashboard/ui";
import { contrastRatio, readableInk } from "@/lib/color";
import { fileToDataUrl } from "@/lib/image-file";
import { videoToUrl } from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

const PALETTE = [
  { color: "#76263c", name: "Bordeaux" },
  { color: "#9c3d1f", name: "Terre cuite" },
  { color: "#b4531f", name: "Orange brûlé" },
  { color: "#3f6b3a", name: "Olive" },
  { color: "#1f5f7a", name: "Bleu canard" },
  { color: "#2b2b2b", name: "Anthracite" },
];

export default function AppearancePage() {
  const { state, updateVenue } = useMenuStore();
  const toast = useToast();
  const { venue } = state;
  const [hex, setHex] = useState(venue.accentColor);
  const [coverVideoUrl, setCoverVideoUrl] = useState(
    venue.coverVideo ? videoToUrl(venue.coverVideo) : "",
  );
  const [message, setMessage] = useState("");
  const contrast = contrastRatio(venue.accentColor, "#fffdf9");

  async function apply(patch: Parameters<typeof updateVenue>[0], done: string) {
    try {
      await updateVenue(patch);
      setMessage(done);
      toast(done);
    } catch (cause) {
      setMessage(errorMessage(cause));
    }
  }

  async function handleImage(
    file: File | undefined,
    target: "logoDataUrl" | "coverImageDataUrl",
  ) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await apply({ [target]: dataUrl }, "Image enregistrée · à publier");
    } catch (cause) {
      setMessage(errorMessage(cause, "Image invalide."));
    }
  }

  function setColor(color: string) {
    setHex(color);
    if (/^#[0-9a-f]{6}$/i.test(color))
      void apply({ accentColor: color.toLowerCase() }, "Couleur enregistrée · à publier");
  }

  return (
    <>
      <PageHead
        back={{ href: "/dashboard/venue", label: "Établissement" }}
        title="Apparence"
      />
      <div className="pro-split">
        <div className="pro-stack">
          <section className="pro-card" aria-labelledby="color-title">
            <h2 className="pro-card-title" id="color-title">
              Couleur de la carte
            </h2>
            <p className="pro-hint">
              Elle habille les prix, les boutons et le numéro de table.
            </p>
            <div className="pro-swatches" role="group" aria-label="Couleurs suggérées">
              {PALETTE.map((entry) => (
                <button
                  key={entry.color}
                  type="button"
                  style={{ background: entry.color }}
                  aria-label={entry.name}
                  aria-pressed={venue.accentColor.toLowerCase() === entry.color}
                  onClick={() => setColor(entry.color)}
                />
              ))}
              <label className="pro-color-input">
                <input
                  type="color"
                  aria-label="Couleur principale"
                  value={venue.accentColor}
                  onChange={(event) => setColor(event.target.value)}
                />
              </label>
            </div>
            <label className="pro-field compact">
              <span>Code couleur</span>
              <input
                className="mono"
                aria-label="Code couleur"
                value={hex}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>
            {contrast < 3 ? (
              <p className="pro-banner warn">
                Couleur très claire : les prix risquent d’être peu lisibles.
                Préférez une teinte plus soutenue.
              </p>
            ) : null}
          </section>

          <section className="pro-card" aria-labelledby="logo-title">
            <h2 className="pro-card-title" id="logo-title">
              Logo
            </h2>
            <p className="pro-hint">Carré de préférence. PNG, JPG ou WebP, 2 Mo maximum.</p>
            <div className="pro-asset">
              {venue.logoDataUrl ? (
                <img className="pro-asset-preview logo" src={venue.logoDataUrl} alt="Logo actuel" />
              ) : (
                <span className="pro-asset-preview logo empty">
                  <ImagePlus size={20} />
                </span>
              )}
              <label className="pro-btn line small">
                Choisir un logo
                <input
                  className="sr-only"
                  data-testid="logo-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImage(event.target.files?.[0], "logoDataUrl")}
                />
              </label>
              {venue.logoDataUrl ? (
                <button
                  className="pro-icon-btn danger"
                  type="button"
                  aria-label="Supprimer le logo"
                  onClick={() => apply({ logoDataUrl: undefined }, "Logo retiré · à publier")}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          </section>

          <section className="pro-card" aria-labelledby="cover-title">
            <h2 className="pro-card-title" id="cover-title">
              Photo de couverture
            </h2>
            <p className="pro-hint">En tête de la carte. Format paysage conseillé.</p>
            <div className="pro-asset">
              {venue.coverImageDataUrl ? (
                <img
                  className="pro-asset-preview cover"
                  src={venue.coverImageDataUrl}
                  alt="Couverture actuelle"
                />
              ) : (
                <span className="pro-asset-preview cover empty">
                  <ImagePlus size={20} />
                </span>
              )}
              <label className="pro-btn line small">
                Choisir une photo
                <input
                  className="sr-only"
                  data-testid="cover-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleImage(event.target.files?.[0], "coverImageDataUrl")
                  }
                />
              </label>
              {venue.coverImageDataUrl ? (
                <button
                  className="pro-icon-btn danger"
                  type="button"
                  aria-label="Supprimer la couverture"
                  onClick={() =>
                    apply({ coverImageDataUrl: undefined }, "Couverture retirée · à publier")
                  }
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          </section>

          <section className="pro-card" aria-labelledby="video-title">
            <h2 className="pro-card-title" id="video-title">
              <PlayCircle size={18} /> Vidéo « Notre histoire »
            </h2>
            <p className="pro-hint">Lien YouTube ou Vimeo, proposé en tête de carte.</p>
            <form
              className="pro-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  const video = coverVideoUrl.trim()
                    ? normalizeExternalVideoUrl(coverVideoUrl)
                    : undefined;
                  void apply(
                    { coverVideo: video },
                    video ? "Vidéo enregistrée · à publier" : "Vidéo retirée · à publier",
                  );
                } catch {
                  setMessage("Utilisez une URL YouTube ou Vimeo valide.");
                }
              }}
            >
              <input
                className="pro-input"
                aria-label="URL de la vidéo de couverture"
                placeholder="https://youtube.com/watch?v=…"
                value={coverVideoUrl}
                onChange={(event) => setCoverVideoUrl(event.target.value)}
              />
              <button className="pro-btn line small" type="submit">
                Enregistrer
              </button>
            </form>
          </section>
          <p className="pro-muted" role="status">
            {message}
          </p>
        </div>

        <aside className="pro-preview" aria-label="Aperçu de l’en-tête de la carte">
          <div
            className="pro-preview-hero"
            style={{
              backgroundImage: venue.coverImageDataUrl
                ? `linear-gradient(180deg, rgba(10,6,5,.2), rgba(16,9,7,.85)), url(${venue.coverImageDataUrl})`
                : `linear-gradient(150deg, ${venue.accentColor}cc, ${venue.accentColor})`,
            }}
          >
            {venue.logoDataUrl ? <img src={venue.logoDataUrl} alt="" /> : null}
            <span
              className="pro-preview-chip"
              style={{ background: venue.accentColor, color: readableInk(venue.accentColor) }}
            >
              Table 12
            </span>
            <strong>{venue.name}</strong>
            <small>{[venue.kind, venue.city].filter(Boolean).join(" · ")}</small>
          </div>
          <div className="pro-preview-body">
            <span className="pro-preview-tab" style={{ borderColor: venue.accentColor }}>
              {state.categories[0]?.name ?? "Entrées"}
            </span>
            <div className="pro-preview-dish">
              <span>{state.categories[0]?.items[0]?.name ?? "Votre premier plat"}</span>
              <b>
                {state.categories[0]?.items[0]
                  ? `${(state.categories[0].items[0].priceCents / 100).toLocaleString("fr-FR")} €`
                  : "12 €"}
              </b>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
