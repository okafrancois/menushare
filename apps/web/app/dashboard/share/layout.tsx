import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Publier et partager · MenuShare" },
  description: "Publiez votre menu, copiez son URL et téléchargez son QR code.",
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
