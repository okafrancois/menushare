"use client";

import { useEffect, useState } from "react";

import { HoursEditor, validateHours } from "@/components/dashboard/hours-editor";
import { errorMessage, PageHead, useToast } from "@/components/dashboard/ui";
import { slugify, validateSlug, type Venue } from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";

export default function SettingsPage() {
  const { state, updateVenue } = useMenuStore();
  const toast = useToast();
  const [form, setForm] = useState<Venue>(state.venue);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const slugError = validateSlug(form.slug);
  const publicHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://menushare.app")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // A venue switch or a save from elsewhere refreshes the form.
  const venueKey = JSON.stringify(state.venue);
  useEffect(() => setForm(JSON.parse(venueKey) as Venue), [venueKey]);

  function field<K extends keyof Venue>(key: K) {
    return {
      value: (form[key] as string | undefined) ?? "",
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm({ ...form, [key]: event.target.value }),
    };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    const hoursError = validateHours(form.openingHours ?? []);
    if (!form.name.trim()) return setError("Le nom est obligatoire.");
    if (slugError) return setError(slugError);
    if (hoursError) return setError(hoursError);
    setSaving(true);
    try {
      await updateVenue({
        name: form.name.trim(),
        kind: form.kind.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        slug: slugify(form.slug),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        hours: form.hours.trim(),
        openingHours: form.openingHours ?? [],
      });
      setStatus("Modifications enregistrées · visibles après publication.");
      toast("Informations enregistrées · à publier");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead
        back={{ href: "/dashboard/venue", label: "Établissement" }}
        title="Informations"
      />
      <form className="pro-stack" onSubmit={save}>
        <section className="pro-card">
          <div className="pro-form flat">
            <label className="pro-field">
              <span>Nom</span>
              <input {...field("name")} required />
            </label>
            <label className="pro-field">
              <span>Type</span>
              <input {...field("kind")} placeholder="Trattoria, bistrot, bar…" />
            </label>
            <label className="pro-field">
              <span>Ville</span>
              <input {...field("city")} />
            </label>
            <label className="pro-field">
              <span>Adresse</span>
              <input {...field("address")} placeholder="12 rue des Remparts, 33000 Bordeaux" />
            </label>
            <label className="pro-field">
              <span>Téléphone</span>
              <input {...field("phone")} inputMode="tel" />
            </label>
            <label className="pro-field">
              <span>Adresse du menu</span>
              <span className="pro-slug">
                <small>{publicHost}/menu/</small>
                <input
                  aria-label="Slug public"
                  value={form.slug}
                  onChange={(event) =>
                    setForm({ ...form, slug: slugify(event.target.value) })
                  }
                />
              </span>
            </label>
            {slugError ? <p className="pro-error">{slugError}</p> : null}
          </div>
        </section>

        <section className="pro-card">
          <h2 className="pro-card-title">Présentation</h2>
          <div className="pro-form flat">
            <label className="pro-field">
              <span>Phrase d’accroche</span>
              <input {...field("tagline")} maxLength={120} />
            </label>
            <label className="pro-field">
              <span>Présentation</span>
              <textarea {...field("description")} rows={4} />
            </label>
          </div>
        </section>

        <section className="pro-card" id="horaires" aria-labelledby="hours-title">
          <h2 className="pro-card-title" id="hours-title">
            Horaires d’ouverture
          </h2>
          <p className="pro-hint">
            Ils affichent « Ouvert jusqu’à… » sur votre carte et servent d’heure
            de retrait par défaut de la suggestion du jour.
          </p>
          <HoursEditor
            value={form.openingHours ?? []}
            onChange={(openingHours) => setForm({ ...form, openingHours })}
          />
          <div className="pro-form flat">
            <label className="pro-field">
              <span>Précision sur les horaires</span>
              <input
                {...field("hours")}
                placeholder="Ex. Fermé en août, brunch le dimanche"
              />
            </label>
          </div>
        </section>

        {error ? (
          <p className="pro-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pro-save-row">
          <span className="pro-muted" role="status">
            {status}
          </span>
          <button className="pro-btn primary" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </>
  );
}
