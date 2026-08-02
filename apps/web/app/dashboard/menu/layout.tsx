import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Composer le menu · MenuShare" },
  description: "Ajoutez et organisez les catégories, plats, images et vidéos.",
};

export default function MenuEditorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
