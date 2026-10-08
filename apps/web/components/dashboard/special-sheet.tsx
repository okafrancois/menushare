"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

import {
  errorMessage,
  ProSheet,
  SheetHead,
  useToast,
} from "@/components/dashboard/ui";
import { fileToDataUrl } from "@/lib/image-file";
import {
  parsePriceToCents,
  priceToInput,
  type DailySpecial,
} from "@/lib/menu-domain";
import { useMenuStore } from "@/lib/menu-store";
import { statsDay } from "@/lib/menu-analytics";
import {
  closingTimeToday,
  formatTime,
  nextOccurrence,
} from "@/lib/opening-hours";

const clock = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function defaultEndTime(
  special: DailySpecial | undefined,
  hours: Parameters<typeof closingTimeToday>[0],
) {
  if (special) return clock.format(special.endsAt);
  return closingTimeToday(hours, Date.now()) ?? "23:00";
}

export function SpecialSheet({
  special,
  onClose,
}: {
  special?: DailySpecial;
  onClose: () => void;
}) {
  const { state, setDailySpecial } = useMenuStore();
  const toast = useToast();
  const [name, setName] = useState(special?.name ?? "");
  const [price, setPrice] = useState(priceToInput(special?.priceCents));
  const [description, setDescription] = useState(special?.description ?? "");
  const [endTime, setEndTime] = useState(() =>
    defaultEndTime(special, state.venue.openingHours),
  );
  // undefined = keep the current photo, null = remove it.
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formKey = JSON.stringify({ name, price, description, endTime, image });
  const initial = useRef(formKey);
  const dirty = formKey !== initial.current;
  useUnsavedChanges(dirty && !saving);
  function requestClose() {
    if (!dirty || confirm("Abandonner les modifications non enregistrées ?"))
      onClose();
  }
  const preview = image === undefined ? special?.imageUrl : image;
  const endLabel = /^\d{2}:\d{2}$/.test(endTime)
    ? `${statsDay(nextOccurrence(endTime, Date.now())) === statsDay(Date.now()) ? "Aujourd’hui" : "Demain"} à ${formatTime(endTime)}`
    : "";

  async function save() {
    setError("");
    try {
      if (!name.trim()) throw new Error("Donnez un nom à la suggestion.");
      if (!/^\d{2}:\d{2}$/.test(endTime))
        throw new Error("Indiquez l’heure de retrait.");
      setSaving(true);
      await setDailySpecial({
        name,
        description,
        priceCents: parsePriceToCents(price),
        imageDataUrl: image,
        endsAt: nextOccurrence(endTime, Date.now()),
      });
      toast("Suggestion en ligne immédiatement");
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProSheet onClose={requestClose} labelledBy="special-sheet-title">
      <SheetHead
        id="special-sheet-title"
        title="Suggestion du jour"
        subtitle="Visible en tête de carte dès l’enregistrement, sans publier."
        onClose={requestClose}
      />
      <div className="pro-sheet-body">
        <div className="pro-photos">
          {preview ? (
            <div className="pro-photo">
              <img src={preview} alt="Photo de la suggestion" />
              <button
                type="button"
                aria-label="Retirer la photo"
                onClick={() => setImage(null)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : null}
          <label className="pro-photo-add">
            <Camera size={20} />
            <span>{preview ? "Changer la photo" : "Ajouter une photo"}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              data-testid="special-photo-input"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  setImage(await fileToDataUrl(file));
                } catch (cause) {
                  setError(errorMessage(cause));
                }
              }}
            />
          </label>
        </div>
        <div className="pro-form">
          <label className="pro-field">
            <span>Nom</span>
            <input
              value={name}
              maxLength={80}
              placeholder="Ex. Risotto aux cèpes"
              onChange={(event) => setName(event.target.value)}
              data-autofocus
            />
          </label>
          <label className="pro-field">
            <span>Prix (€)</span>
            <input
              value={price}
              inputMode="decimal"
              placeholder="0,00"
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <label className="pro-field">
            <span>Description</span>
            <input
              value={description}
              maxLength={140}
              placeholder="Ingrédients, origine, préparation…"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="pro-field inline">
            <span>
              Retirer de la carte à{endLabel ? <small>{endLabel}</small> : null}
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
        </div>
        {error ? (
          <p className="pro-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="pro-sheet-foot">
        <button
          className="pro-btn primary block"
          type="button"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Mise en ligne…" : "Mettre en ligne maintenant"}
        </button>
      </footer>
    </ProSheet>
  );
}
