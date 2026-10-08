"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMenuStore } from "@/lib/menu-store";
import { usePublication } from "@/lib/use-publication";
import { errorMessage, useToast } from "./ui";

export function VenueLifecycle() {
  const { state, setVenueStatus, removeVenue, venues } = useMenuStore();
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const { online } = usePublication();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const archived = state.venue.status === "archived";
  async function change(status: "draft" | "archived") {
    if (
      !confirm(
        status === "archived"
          ? "Archiver cet établissement et retirer sa carte du public ? Vos données seront conservées."
          : online
            ? "Mettre la carte hors ligne ? Les QR afficheront un menu indisponible jusqu’à la prochaine publication."
            : "Réactiver cet établissement ? Sa carte restera hors ligne jusqu’à votre prochaine publication.",
      )
    )
      return;
    setBusy(true);
    try {
      await setVenueStatus(status);
      toast(
        status === "archived"
          ? "Établissement archivé"
          : "Établissement hors ligne · publiez pour le remettre en ligne",
      );
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pro-card">
      <h2 className="pro-card-title">Visibilité de l’établissement</h2>
      <p className="pro-hint">
        {archived
          ? "Archivé : la carte est inaccessible au public."
          : online
            ? "Votre carte est en ligne."
            : "Votre carte est hors ligne. Publiez pour activer vos QR codes."}{" "}
        Vos QR restent les mêmes après réactivation.
      </p>
      <div className="pro-btn-row">
        {online ? (
          <button
            className="pro-btn line"
            disabled={busy}
            onClick={() => change("draft")}
          >
            Mettre hors ligne
          </button>
        ) : null}
        <button
          className="pro-btn line"
          disabled={busy}
          onClick={() => change(archived ? "draft" : "archived")}
        >
          {archived ? "Réactiver l’établissement" : "Archiver l’établissement"}
        </button>
      </div>
      <details className="help-question">
        <summary>Supprimer définitivement cet établissement</summary>
        <p>
          Sa carte, ses fichiers et ses statistiques seront supprimés. Cette
          action ne peut pas être annulée.
        </p>
        <label className="pro-field">
          <span>Recopiez « {state.venue.name} » pour confirmer</span>
          <input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="pro-btn danger"
          disabled={busy || confirmName !== state.venue.name}
          onClick={async () => {
            setBusy(true);
            try {
              await removeVenue(confirmName);
              router.replace(
                venues.length > 1 ? "/dashboard/venue" : "/onboarding",
              );
              toast("Établissement supprimé");
            } catch (error) {
              toast(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Supprimer définitivement
        </button>
      </details>
    </section>
  );
}
