"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import {
  usePrivacyPreference,
  setPrivacyPreference,
} from "@/lib/privacy-preferences";
export default function PrivacyPage() {
  const analytics = usePrivacyPreference("analytics");
  const videos = usePrivacyPreference("videos");
  const [message, setMessage] = useState("");
  function change(key: "analytics" | "videos", enabled: boolean) {
    try {
      setPrivacyPreference(key, enabled);
      setMessage("Préférences enregistrées sur cet appareil.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer ce choix.",
      );
    }
  }
  return (
    <main className="utility-page">
      <Brand />
      <h1>Vos données et vos choix</h1>
      <p>
        Vous pouvez consulter la carte et préparer votre sélection sans activer
        les statistiques ni les vidéos externes.
      </p>
      <section className="pro-card pro-checklist">
        <label>
          <input
            type="checkbox"
            checked={analytics}
            onChange={(event) => change("analytics", event.target.checked)}
          />
          <span>
            <strong>Autoriser les statistiques de consultation</strong>
            <br />
            Aider l’établissement à comprendre les scans, les plats consultés et
            le temps de lecture. Désactivé par défaut.
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={videos}
            onChange={(event) => change("videos", event.target.checked)}
          />
          <span>
            <strong>Autoriser les lecteurs YouTube et Vimeo</strong>
            <br />
            Ces services reçoivent des informations de connexion lors du
            chargement de leurs lecteurs. Désactivé par défaut.
          </span>
        </label>
        <p role="status">{message}</p>
      </section>
      <h2>Quand vous consultez une carte</h2>
      <p>
        Votre sélection est conservée 12 heures dans ce navigateur. Le contexte
        de table est mémorisé pour la session. Si vous autorisez les
        statistiques, un identifiant distinct par établissement est conservé au
        maximum 13 mois sur cet appareil. Les sessions de mesure sont conservées
        2 jours et les identifiants côté serveur 100 jours ; des totaux
        quotidiens sont conservés pour les statistiques.
      </p>
      <p>
        Le code de mesure de MenuShare n’enregistre pas votre adresse IP. Les
        services d’hébergement et les lecteurs externes peuvent traiter des
        données de connexion pour fonctionner. YouTube et Vimeo appliquent
        également leurs propres politiques.
      </p>
      <h2>Quand vous gérez un établissement</h2>
      <p>
        MenuShare utilise votre profil de connexion pour protéger l’accès à vos
        établissements et conserve les menus et médias que vous enregistrez. Le
        code reçu par email sert à vérifier votre accès. Les données de
        démonstration restent uniquement dans votre navigateur.
      </p>
      <h2>Exporter et supprimer</h2>
      <p>
        Dans <Link href="/dashboard/account">Mon compte</Link>, vous pouvez
        exporter vos données ou supprimer votre compte. Vos cartes sont alors
        retirées du public et la suppression des données associées est lancée.
        Pour une autre demande, utilisez{" "}
        <Link href="/help">les informations de contact du prototype</Link>.
      </p>
      <p>
        Vos préférences facultatives sont conservées six mois. Vous pouvez les
        modifier à tout moment ici.
      </p>
      <div className="pro-utility-links">
        <Link href="/">Accueil</Link>
        <Link href="/help">Aide</Link>
        <Link href="/terms">Conditions d’utilisation</Link>
      </div>
    </main>
  );
}
