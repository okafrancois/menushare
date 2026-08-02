import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Nouvel établissement · MenuShare" },
  description: "Ajoutez un nouvel établissement à votre espace MenuShare.",
};

export default function NewEstablishmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
