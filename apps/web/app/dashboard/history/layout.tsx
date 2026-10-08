import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Historique des publications · MenuShare" },
  description: "Retrouvez et restaurez les dernières versions de votre carte.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
