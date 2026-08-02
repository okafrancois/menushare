import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Apparence du menu · MenuShare" },
  description: "Personnalisez le logo, la couverture et les couleurs du menu.",
};

export default function AppearanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
