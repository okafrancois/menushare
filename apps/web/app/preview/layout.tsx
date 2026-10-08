import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Aperçu du brouillon",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
