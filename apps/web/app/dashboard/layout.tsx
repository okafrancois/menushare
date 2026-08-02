import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: {
    default: "Tableau de bord",
    template: "%s · MenuShare",
  },
  description: "Gérez vos établissements et leurs menus sur MenuShare.",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
