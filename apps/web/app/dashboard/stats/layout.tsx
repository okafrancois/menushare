import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Statistiques · MenuShare" },
  description:
    "Scans, visiteurs, plats consultés et vidéos regardées sur votre menu.",
};

export default function StatsLayout({ children }: { children: ReactNode }) {
  return children;
}
