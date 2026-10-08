"use client";

export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui",
          padding: 32,
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <h1>MenuShare n’a pas pu charger votre espace.</h1>
        <p>
          Vérifiez votre connexion, puis réessayez. Les données déjà
          enregistrées sont conservées.
        </p>
        <button onClick={reset}>Réessayer</button>
        <p>
          <a href="/help">Consulter l’aide</a>
        </p>
      </body>
    </html>
  );
}
