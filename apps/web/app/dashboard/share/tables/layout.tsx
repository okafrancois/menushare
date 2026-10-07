import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "QR codes des tables · MenuShare" },
  description: "Imprimez un QR code numéroté pour chaque table.",
};

export default function TableQrLayout({ children }: { children: ReactNode }) {
  return children;
}
