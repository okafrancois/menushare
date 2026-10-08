"use client";

import { useState } from "react";
import { PageHead, errorMessage, useToast } from "@/components/dashboard/ui";
import { useMenuStore } from "@/lib/menu-store";
import { downloadFile } from "@/lib/download";
import { menuCsv, parseMenuCsv, type ImportRow } from "@/lib/menu-import";
import { formatPrice } from "@/lib/menu-domain";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function MenuToolsPage() {
  const { state, importItems } = useMenuStore();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useUnsavedChanges(rows.length > 0 && !busy);
  return (
    <>
      <PageHead
        title="Importer et exporter"
        back={{ href: "/dashboard/menu", label: "Carte" }}
      />
      <div className="pro-stack">
        <section className="pro-card">
          <h2 className="pro-card-title">Exporter votre carte</h2>
          <p className="pro-hint">
            Le CSV contient les catégories, noms, prix et descriptions. Le
            fichier JSON conserve aussi les autres informations du brouillon.
            Conservez vos photos originales séparément.
          </p>
          <div className="pro-btn-row">
            <button
              className="pro-btn line"
              onClick={() =>
                downloadFile(
                  `${state.venue.slug}.csv`,
                  menuCsv(state),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Exporter en CSV
            </button>
            <button
              className="pro-btn line"
              onClick={() =>
                downloadFile(
                  `${state.venue.slug}.json`,
                  JSON.stringify(
                    {
                      format: "menushare-menu",
                      version: 1,
                      exportedAt: new Date().toISOString(),
                      ...state,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Exporter en JSON
            </button>
          </div>
        </section>
        <section className="pro-card">
          <h2 className="pro-card-title">Importer des plats depuis un CSV</h2>
          <p className="pro-hint">
            Jusqu’à 500 plats par import. Les plats sont ajoutés aux catégories
            de même nom, sans remplacer votre carte. Les allergènes et les
            photos restent à compléter. Les prix sont en euros.
          </p>
          <div className="pro-btn-row">
            <button
              className="pro-btn line"
              onClick={() =>
                downloadFile(
                  "modele-menushare.csv",
                  "\uFEFFcategorie;nom;prix;description\r\nEntrées;Salade du marché;12.50;Légumes de saison\r\nPlats;Risotto;18.00;Risotto aux champignons",
                  "text/csv;charset=utf-8",
                )
              }
            >
              Télécharger le modèle
            </button>
            <label className="pro-btn primary">
              Choisir un fichier CSV
              <input
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setError("");
                  setRows([]);
                  try {
                    if (file.size > 1_000_000)
                      throw new Error("Le fichier doit faire moins de 1 Mo.");
                    setRows(parseMenuCsv(await file.text()));
                  } catch (error) {
                    setError(errorMessage(error));
                  }
                }}
              />
            </label>
          </div>
          {rows.length ? (
            <>
              <p>
                {rows.length} plats prêts à être ajoutés ·{" "}
                {new Set(rows.map((row) => row.category)).size} catégories
              </p>
              <div className="pro-import-preview">
                <table>
                  <caption className="sr-only">
                    Aperçu des plats à importer
                  </caption>
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>Plat</th>
                      <th>Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, index) => (
                      <tr key={index}>
                        <td>{row.category}</td>
                        <td>{row.name}</td>
                        <td>{formatPrice(row.priceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 ? (
                  <p>Et {rows.length - 20} autres plats.</p>
                ) : null}
              </div>
              <div className="pro-btn-row">
                <button
                  className="pro-btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await importItems(rows);
                      toast(`${rows.length} plats importés dans le brouillon`);
                      setRows([]);
                    } catch (error) {
                      setError(errorMessage(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Import…" : "Ajouter au brouillon"}
                </button>
                <button
                  className="pro-btn line"
                  disabled={busy}
                  onClick={() => setRows([])}
                >
                  Annuler
                </button>
              </div>
            </>
          ) : null}
          {error ? (
            <p className="pro-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
