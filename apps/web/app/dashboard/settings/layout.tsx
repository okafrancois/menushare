import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Informations de l’établissement · MenuShare" },
  description: "Nom, adresse, présentation et horaires d’ouverture de l’établissement.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
