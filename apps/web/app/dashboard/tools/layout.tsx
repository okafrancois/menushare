import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Importer et exporter · MenuShare" },
  description: "Importez vos plats et exportez votre carte.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
