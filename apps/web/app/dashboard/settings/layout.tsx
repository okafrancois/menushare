import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Réglages de l’établissement · MenuShare" },
  description: "Modifiez les informations et l’adresse publique du menu.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
