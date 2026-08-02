"use client";

import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { useMenuStore } from "@/lib/menu-store";

export default function SharePage() {
  const { state, publish } = useMenuStore();
  const [origin, setOrigin] = useState("https://menushare.app");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const url = `${origin}/menu/${state.venue.slug}`;

  useEffect(() => setOrigin(window.location.origin), []);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard can be unavailable on HTTP */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">Diffusion</span>
          <h1 className="serif">Partager le menu</h1>
        </div>
        {state.published ? (
          <span className="status-pill">
            <Check size={14} /> En ligne · v{state.published.version}
          </span>
        ) : (
          <span className="status-pill draft">Brouillon</span>
        )}
      </div>
      <div className="share-grid">
        <section className="share-card">
          <span className="eyebrow">Adresse publique</span>
          <h2 className="serif">Une URL simple, partout.</h2>
          <p>
            Ajoutez-la à Instagram, Google Business, votre site ou envoyez-la
            directement à vos clients.
          </p>
          <div className="url-box">
            <code>{url}</code>
            <button
              className="icon-button"
              type="button"
              aria-label="Copier l’URL"
              onClick={copyUrl}
            >
              {copied ? <Check /> : <Copy />}
            </button>
          </div>
          <div className="share-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={publish}
            >
              {state.published
                ? "Republier les modifications"
                : "Publier le menu"}
            </button>
            <Link className="button" href={`/menu/${state.venue.slug}`}>
              <ExternalLink size={16} /> Ouvrir
            </Link>
          </div>
        </section>
        <section className="qr-card">
          <div className="qr-frame" ref={qrRef} data-testid="qr-code">
            <QRCodeSVG
              value={url}
              size={220}
              level="H"
              bgColor="#fffdf9"
              fgColor={state.venue.accentColor}
              imageSettings={
                state.venue.logoDataUrl
                  ? {
                      src: state.venue.logoDataUrl,
                      height: 36,
                      width: 36,
                      excavate: true,
                    }
                  : undefined
              }
            />
          </div>
          <h2>QR code prêt à imprimer</h2>
          <p>
            Le QR code pointe toujours vers la même URL, même après une mise à
            jour du menu.
          </p>
          <button
            className="button button-dark"
            type="button"
            onClick={downloadQr}
          >
            <Download size={16} /> Télécharger en SVG
          </button>
        </section>
      </div>
      <div className="info-banner">
        <QrCode />
        <div>
          <strong>Conseil d’impression</strong>
          <p>
            Gardez une zone blanche autour du QR code et imprimez-le au minimum
            en 3 × 3 cm.
          </p>
        </div>
      </div>
    </>
  );
}
