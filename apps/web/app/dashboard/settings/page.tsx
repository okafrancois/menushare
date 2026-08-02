"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { slugify, validateSlug } from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

export default function SettingsPage() {
  const { state, updateVenue, resetDemo } = useMenuStore();
  const [form, setForm] = useState(state.venue);
  const [saved, setSaved] = useState(false);
  const slugError = validateSlug(form.slug);
  useEffect(() => setForm(state.venue), [state.venue]);

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">Établissement</span>
          <h1 className="serif">Réglages</h1>
        </div>
      </div>
      <form
        className="settings-card settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (slugError) return;
          updateVenue({ ...form, slug: slugify(form.slug) });
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1600);
        }}
      >
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="settings-name">Nom</label>
            <input
              className="input"
              id="settings-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="settings-kind">Type</label>
            <input
              className="input"
              id="settings-kind"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="settings-city">Ville</label>
            <input
              className="input"
              id="settings-city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="settings-phone">Téléphone</label>
            <input
              className="input"
              id="settings-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="settings-slug">Slug public</label>
            <div className="slug-input">
              <span>menushare.app/</span>
              <input
                id="settings-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: slugify(e.target.value) })
                }
              />
            </div>
            {slugError ? <span className="form-error">{slugError}</span> : null}
          </div>
          <div className="form-group span-2">
            <label htmlFor="settings-tagline">Phrase d’accroche</label>
            <input
              className="input"
              id="settings-tagline"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="settings-description">Présentation</label>
            <textarea
              className="input textarea"
              id="settings-description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="settings-address">Adresse</label>
            <input
              className="input"
              id="settings-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="form-group span-2">
            <label htmlFor="settings-hours">Horaires</label>
            <input
              className="input"
              id="settings-hours"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-actions">
          <span className="save-message" role="status">
            {saved ? "Modifications enregistrées." : ""}
          </span>
          <button
            className="button button-primary"
            type="submit"
            disabled={Boolean(slugError)}
          >
            Enregistrer
          </button>
        </div>
      </form>
      <section className="danger-zone">
        <div>
          <h2>Réinitialiser le mode démo</h2>
          <p>
            Remet les données locales de Nonna Lydie. Cette action remplace
            votre brouillon actuel.
          </p>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => {
            if (confirm("Réinitialiser toutes les données locales ?"))
              resetDemo();
          }}
        >
          <RotateCcw size={16} /> Réinitialiser
        </button>
      </section>
    </>
  );
}
