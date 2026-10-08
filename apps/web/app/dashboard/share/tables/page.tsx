"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { PageHead } from "@/components/dashboard/ui";
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
      <div className="no-print">
        <PageHead
          back={{ href: "/dashboard/share", label: "QR codes" }}
          title="QR codes des tables"
          actions={
            tableCount ? (
              <button
                className="pro-btn primary small"
                type="button"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Imprimer ou PDF
              </button>
            ) : null
          }
        />
      </div>
      {tableCount ? (
        <>
          <p className="pro-hint no-print">
            Format A4, 12 QR codes par page. Choisissez « Enregistrer au format
            PDF » dans la fenêtre d’impression pour l’envoyer à un imprimeur.
          </p>
          <div className="table-sheet" data-testid="table-qr-sheet">
            {Array.from({ length: tableCount }, (_, index) => index + 1).map((table) => (
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
                      ? { src: state.venue.logoDataUrl, height: 26, width: 26, excavate: true }
                      : undefined
                  }
                />
                <strong>Table {table}</strong>
                <small>Scannez pour découvrir la carte</small>
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className="pro-card pro-empty">
          <h2>Aucune table configurée.</h2>
          <p>Indiquez votre nombre de tables pour générer leurs QR codes.</p>
          <Link className="pro-btn primary" href="/dashboard/share">
            Configurer les tables
          </Link>
        </section>
      )}
    </>
  );
}
