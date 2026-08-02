import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Créer votre premier établissement",
  description:
    "Configurez votre premier établissement et choisissez l’adresse de son menu.",
};

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
