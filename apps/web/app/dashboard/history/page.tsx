"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHead, errorMessage, useToast } from "@/components/dashboard/ui";
import { useMenuStore } from "@/lib/menu-store";

export default function HistoryPage() {
  const { history, restoreVersion } = useMenuStore();
  const [busy, setBusy] = useState<number | null>(null);
  const toast = useToast();
  return (
    <>
      <PageHead
        title="Historique des publications"
        back={{ href: "/dashboard/menu", label: "Carte" }}
      />
      <section className="pro-card">
        <p className="pro-hint">
          Les 10 dernières versions sont conservées. Restaurer remplace votre
          brouillon ; la carte en ligne reste inchangée jusqu’à votre prochaine
          publication.
        </p>
        {!history.length ? (
          <p>Aucune publication. Votre première version apparaîtra ici.</p>
        ) : (
          history.map((snapshot) => (
            <div className="pro-history-row" key={snapshot.version}>
              <div>
                <strong>Version {snapshot.version}</strong>
                <small>
                  {new Date(snapshot.publishedAt).toLocaleString("fr-FR")} ·{" "}
                  {snapshot.categories.reduce((n, c) => n + c.items.length, 0)}{" "}
                  plats
                </small>
              </div>
              <button
                className="pro-btn line small"
                disabled={busy !== null}
                onClick={async () => {
                  if (
                    !confirm(
                      `Remplacer le brouillon par la version ${snapshot.version} ? Les modifications non publiées seront remplacées.`,
                    )
                  )
                    return;
                  setBusy(snapshot.version);
                  try {
                    await restoreVersion(snapshot.version);
                    toast("Version restaurée dans le brouillon · à publier");
                  } catch (error) {
                    toast(errorMessage(error));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === snapshot.version ? "Restauration…" : "Restaurer"}
              </button>
            </div>
          ))
        )}
      </section>
      <div className="pro-utility-links">
        <Link href="/preview">Prévisualiser le brouillon</Link>
        <Link href="/dashboard/menu">Modifier la carte</Link>
      </div>
    </>
  );
}
