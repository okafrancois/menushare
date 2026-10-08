import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "QR codes et tables · MenuShare" },
  description: "QR code général de la carte et QR codes par table, prêts à imprimer.",
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
