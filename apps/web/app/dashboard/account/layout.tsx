import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Mon compte · MenuShare" },
  description: "Gérez votre profil, vos connexions et vos données.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
