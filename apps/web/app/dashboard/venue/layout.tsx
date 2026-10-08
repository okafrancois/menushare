import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Établissement · MenuShare" },
  description:
    "QR codes, apparence, informations pratiques et établissements de votre compte.",
};

export default function VenueLayout({ children }: { children: ReactNode }) {
  return children;
}
