"use client";

import { ImagePlus, PlayCircle, Trash2 } from "lucide-react";
import { useState } from "react";

import { MenuPhonePreview } from "@/components/menu/menu-phone-preview";
import { fileToDataUrl } from "@/lib/image-file";
import { useMenuStore } from "@/lib/menu-store";
import { normalizeExternalVideoUrl } from "@repo/backend/video";

export default function AppearancePage() {
  const { state, updateVenue } = useMenuStore();
  const [coverVideoUrl, setCoverVideoUrl] = useState(
    state.venue.coverVideo
      ? state.venue.coverVideo.provider === "youtube"
        ? `https://youtu.be/${state.venue.coverVideo.externalId}`
        : `https://vimeo.com/${state.venue.coverVideo.externalId}`
      : "",
  );
  const [message, setMessage] = useState("");

  async function handleImage(
    file: File | undefined,
    target: "logoDataUrl" | "coverImageDataUrl",
  ) {
    if (!file) return;
    try {
      updateVenue({ [target]: await fileToDataUrl(file) });
      setMessage("Image enregistrée dans le brouillon.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Image invalide.");
    }
  }

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">Identité visuelle</span>
          <h1 className="serif">Apparence</h1>
        </div>
      </div>
      <div className="builder-grid">
        <section className="settings-stack">
          <article className="settings-card">
            <h2>Couleur principale</h2>
            <p>
              Elle habille les boutons, les prix et les accents du menu public.
            </p>
            <div className="color-control">
              <input
                aria-label="Couleur principale"
                type="color"
                value={state.venue.accentColor}
                onChange={(e) => updateVenue({ accentColor: e.target.value })}
              />
              <input
                className="input mono"
                aria-label="Code couleur"
                value={state.venue.accentColor}
                onChange={(e) =>
                  /^#[0-9a-f]{6}$/i.test(e.target.value) &&
                  updateVenue({ accentColor: e.target.value })
                }
              />
            </div>
          </article>
          <article className="settings-card">
            <h2>Logo</h2>
            <p>PNG, JPG ou WebP, 2 Mo maximum.</p>
            <div className="asset-row">
              {state.venue.logoDataUrl ? (
                <img
                  className="asset-preview logo"
                  src={state.venue.logoDataUrl}
                  alt="Logo actuel"
                />
              ) : (
                <span className="asset-placeholder">
                  <ImagePlus />
                </span>
              )}
              <label className="button">
                Choisir un logo
                <input
                  className="sr-only"
                  data-testid="logo-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImage(e.target.files?.[0], "logoDataUrl")
                  }
                />
              </label>
              {state.venue.logoDataUrl ? (
                <button
                  className="icon-button danger"
                  aria-label="Supprimer le logo"
                  onClick={() => updateVenue({ logoDataUrl: undefined })}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          </article>
          <article className="settings-card">
            <h2>Image de couverture</h2>
            <p>Affichée en plein écran à l’ouverture du menu.</p>
            <div className="asset-row">
              {state.venue.coverImageDataUrl ? (
                <img
                  className="asset-preview cover"
                  src={state.venue.coverImageDataUrl}
                  alt="Couverture actuelle"
                />
              ) : (
                <span className="asset-placeholder cover">
                  <ImagePlus />
                </span>
              )}
              <label className="button">
                Choisir une couverture
                <input
                  className="sr-only"
                  data-testid="cover-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImage(e.target.files?.[0], "coverImageDataUrl")
                  }
                />
              </label>
              {state.venue.coverImageDataUrl ? (
                <button
                  className="icon-button danger"
                  aria-label="Supprimer la couverture"
                  onClick={() => updateVenue({ coverImageDataUrl: undefined })}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          </article>
          <article className="settings-card">
            <h2>
              <PlayCircle size={20} /> Vidéo de couverture
            </h2>
            <p>
              Seules les URLs YouTube et Vimeo sont acceptées pour cette
              version.
            </p>
            <div className="field-action">
              <input
                className="input"
                aria-label="URL de la vidéo de couverture"
                placeholder="https://youtube.com/watch?v=…"
                value={coverVideoUrl}
                onChange={(e) => setCoverVideoUrl(e.target.value)}
              />
              <button
                className="button"
                type="button"
                onClick={() => {
                  try {
                    updateVenue({
                      coverVideo: coverVideoUrl.trim()
                        ? normalizeExternalVideoUrl(coverVideoUrl)
                        : undefined,
                    });
                    setMessage("Vidéo enregistrée dans le brouillon.");
                  } catch {
                    setMessage("Utilisez une URL YouTube ou Vimeo valide.");
                  }
                }}
              >
                Enregistrer
              </button>
            </div>
          </article>
          {message ? (
            <p className="save-message" role="status">
              {message}
            </p>
          ) : null}
        </section>
        <aside className="builder-preview">
          <MenuPhonePreview venue={state.venue} categories={state.categories} />
        </aside>
      </div>
    </>
  );
}
