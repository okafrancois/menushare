"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { menuQrUrl } from "@/lib/menu-analytics";
import { useMenuStore } from "@/lib/menu-store";

export default function TableQrSheetPage() {
  const { state } = useMenuStore();
  const [origin, setOrigin] = useState("https://menushare.app");
  const tableCount = state.venue.tableCount ?? 0;
  const menuUrl = `${origin}/menu/${state.venue.slug}`;

  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <>
      <div className="dashboard-head no-print">
        <div>
          <Link className="back-link" href="/dashboard/share">
            <ArrowLeft size={15} /> Partager
          </Link>
          <h1 className="serif">QR codes des tables</h1>
        </div>
        {tableCount ? (
          <button
            className="button button-primary"
            type="button"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Imprimer ou enregistrer en PDF
          </button>
        ) : null}
      </div>
      {tableCount ? (
        <>
          <p className="table-sheet-hint no-print">
            Format A4, 12 QR codes par page. Choisissez « Enregistrer au format
            PDF » dans la fenêtre d’impression pour l’envoyer à un imprimeur.
          </p>
          <div className="table-sheet" data-testid="table-qr-sheet">
            {Array.from({ length: tableCount }, (_, index) => index + 1).map(
              (table) => (
                <article className="table-qr" key={table}>
                  <span className="table-qr-venue">{state.venue.name}</span>
                  <QRCodeSVG
                    value={menuQrUrl(menuUrl, table)}
                    size={150}
                    level="H"
                    bgColor="#ffffff"
                    fgColor={state.venue.accentColor}
                    imageSettings={
                      state.venue.logoDataUrl
                        ? {
                            src: state.venue.logoDataUrl,
                            height: 26,
                            width: 26,
                            excavate: true,
                          }
                        : undefined
                    }
                  />
                  <strong className="serif">Table {table}</strong>
                  <small>Scannez pour découvrir le menu</small>
                </article>
              ),
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2 className="serif">Aucune table configurée.</h2>
          <p>Indiquez votre nombre de tables depuis la page Partager.</p>
          <Link className="button button-primary" href="/dashboard/share">
            Configurer les tables
          </Link>
        </div>
      )}
    </>
  );
}
