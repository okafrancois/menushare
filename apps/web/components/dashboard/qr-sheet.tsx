"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { ProSheet, SheetHead } from "@/components/dashboard/ui";
import { menuQrUrl } from "@/lib/menu-analytics";
import { useMenuStore } from "@/lib/menu-store";

/** Large QR code to show on screen, e.g. to a guest without a printed one. */
export function QrSheet({ onClose }: { onClose: () => void }) {
  const { state } = useMenuStore();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/menu/${state.venue.slug}`;
  return (
    <ProSheet onClose={onClose} labelledBy="qr-sheet-title">
      <SheetHead
        id="qr-sheet-title"
        title="Scannez pour voir la carte"
        subtitle={url.replace(/^https?:\/\//, "")}
        onClose={onClose}
      />
      <div className="pro-sheet-body pro-qr-show">
        {origin ? (
          <div className="pro-qr-frame large">
            <QRCodeSVG
              value={menuQrUrl(url)}
              size={260}
              level="H"
              bgColor="#ffffff"
              fgColor={state.venue.accentColor}
            />
          </div>
        ) : null}
      </div>
    </ProSheet>
  );
}
