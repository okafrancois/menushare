"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="public-not-found">
      <h1>Cette page n’a pas pu se charger.</h1>
      <p>
        Vos données enregistrées sont conservées. Vérifiez votre connexion et
        réessayez.
      </p>
      <div className="pro-btn-row">
        <button className="pro-btn primary" onClick={reset}>
          Réessayer
        </button>
        <Link className="pro-btn line" href="/help">
          Obtenir de l’aide
        </Link>
      </div>
    </main>
  );
}
