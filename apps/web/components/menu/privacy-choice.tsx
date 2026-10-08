"use client";

import { useState } from "react";
import {
  setPrivacyPreference,
  useHasPrivacyChoice,
} from "@/lib/privacy-preferences";

export function PrivacyChoice() {
  const chosen = useHasPrivacyChoice();
  const [error, setError] = useState("");
  function choose(allowed: boolean) {
    try {
      setPrivacyPreference("analytics", allowed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Ce choix n’a pas pu être enregistré.",
      );
    }
  }
  if (chosen) return null;
  return (
    <section
      className="pm-privacy-choice"
      aria-label="Statistiques facultatives"
    >
      <strong>Aider l’établissement à améliorer sa carte</strong>
      <p>
        Autoriser les statistiques de consultation des plats ? Ce choix est
        facultatif et modifiable dans vos préférences.
      </p>
      <div>
        <button className="pm-btn line" onClick={() => choose(false)}>
          Non merci
        </button>
        <button className="pm-btn line" onClick={() => choose(true)}>
          Autoriser
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
