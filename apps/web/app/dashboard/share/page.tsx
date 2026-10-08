"use client";

import { Copy, Download, ExternalLink, Minus, Plus, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { errorMessage, PageHead, useToast } from "@/components/dashboard/ui";
import { menuQrUrl } from "@/lib/menu-analytics";
import { useMenuStore } from "@/lib/menu-store";

const MAX_TABLES = 200;

export default function SharePage() {
  const { state } = useMenuStore();
  const toast = useToast();
  const [origin, setOrigin] = useState("https://menushare.app");
  const qrRef = useRef<HTMLDivElement>(null);
  const url = `${origin}/menu/${state.venue.slug}`;

  useEffect(() => setOrigin(window.location.origin), []);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien de la carte copié");
    } catch {
      toast(url);
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: state.venue.name, url });
      else await copyUrl();
    } catch {
      // Sharing cancelled.
    }
  }

  function downloadQr() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `qr-${state.venue.slug}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <PageHead
        back={{ href: "/dashboard/venue", label: "Établissement" }}
        title="QR codes et tables"
      />
      {!state.published ? (
        <p className="pro-banner warn">
          Votre carte n’est pas encore publiée : le QR code mènera à une page
          vide tant que vous n’aurez pas publié.
        </p>
      ) : null}
      <div className="pro-split">
        <section className="pro-card pro-qr-card" aria-labelledby="qr-title">
          <div className="pro-qr-frame" ref={qrRef} data-testid="qr-code">
            <QRCodeSVG
              value={menuQrUrl(url)}
              size={200}
              level="H"
              bgColor="#ffffff"
              fgColor={state.venue.accentColor}
              imageSettings={
                state.venue.logoDataUrl
                  ? { src: state.venue.logoDataUrl, height: 34, width: 34, excavate: true }
                  : undefined
              }
            />
          </div>
          <h2 id="qr-title">QR code général</h2>
          <p className="pro-hint">
            Vitrine, flyers, réseaux sociaux. Il reste valable après chaque mise à
            jour de la carte. Imprimez-le au minimum en 3 × 3 cm.
          </p>
          <div className="pro-url">
            <code>{url.replace(/^https?:\/\//, "")}</code>
            <button className="pro-icon-btn plain" type="button" aria-label="Copier l’URL" onClick={copyUrl}>
              <Copy size={17} />
            </button>
            <Link
              className="pro-icon-btn plain"
              href={`/menu/${state.venue.slug}`}
              target="_blank"
              aria-label="Ouvrir la carte publique"
            >
              <ExternalLink size={17} />
            </Link>
          </div>
          <div className="pro-btn-row">
            <button className="pro-btn dark small" type="button" onClick={downloadQr}>
              <Download size={16} /> Télécharger en SVG
            </button>
            <button className="pro-btn ghost small" type="button" onClick={share}>
              <Share2 size={16} /> Partager le lien
            </button>
          </div>
        </section>
        <TableSettings menuUrl={url} />
      </div>
    </>
  );
}

function TableSettings({ menuUrl }: { menuUrl: string }) {
  const { state, setTableCount } = useMenuStore();
  const toast = useToast();
  const tableCount = state.venue.tableCount ?? 0;
  const [value, setValue] = useState(String(tableCount));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(String(tableCount)), [tableCount]);
  const next = Number(value);
  const valid = Number.isInteger(next) && next >= 0 && next <= MAX_TABLES;

  async function save(count: number) {
    setSaving(true);
    try {
      await setTableCount(count);
      toast(count ? `${count} QR code${count > 1 ? "s" : ""} de table prêt${count > 1 ? "s" : ""}` : "QR codes de table retirés");
    } catch (cause) {
      toast(errorMessage(cause, "Enregistrement impossible, réessayez."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pro-card" aria-labelledby="tables-title">
      <h2 className="pro-card-title" id="tables-title">
        Un QR code par table
      </h2>
      <p className="pro-hint">
        Le client voit « Table N » sur la carte, et vos statistiques comparent
        chaque emplacement. Le nombre de tables ne demande pas de republier.
      </p>
      <form
        className="pro-table-count"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && next !== tableCount) void save(next);
        }}
      >
        <label htmlFor="table-count">Nombre de tables</label>
        <div className="pro-stepper">
          <button
            type="button"
            aria-label="Une table de moins"
            onClick={() => setValue(String(Math.max(0, (valid ? next : tableCount) - 1)))}
          >
            <Minus size={16} />
          </button>
          <input
            id="table-count"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_TABLES}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="button"
            aria-label="Une table de plus"
            onClick={() => setValue(String(Math.min(MAX_TABLES, (valid ? next : tableCount) + 1)))}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          className="pro-btn line small"
          type="submit"
          disabled={!valid || next === tableCount || saving}
        >
          Enregistrer
        </button>
      </form>
      {tableCount ? (
        <>
          <div className="pro-table-grid" aria-label="Aperçu des QR codes de table">
            {Array.from({ length: Math.min(tableCount, 8) }, (_, index) => index + 1).map((table) => (
              <figure key={table}>
                <QRCodeSVG value={menuQrUrl(menuUrl, table)} size={64} level="M" />
                <figcaption>Table {table}</figcaption>
              </figure>
            ))}
            {tableCount > 8 ? <span className="pro-more">+{tableCount - 8}</span> : null}
          </div>
          <Link className="pro-btn primary block" href="/dashboard/share/tables">
            <Printer size={16} /> Imprimer les {tableCount} QR codes
          </Link>
        </>
      ) : null}
    </section>
  );
}
