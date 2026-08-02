"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { useMenuStore } from "@/lib/menu-store";

export function ProtectedWorkspace({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "dashboard" | "onboarding";
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { state, hydrated, remote } = useMenuStore();

  useEffect(() => {
    if (!remote || isPending || !hydrated) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    if (mode === "dashboard" && !state.venue.id) {
      router.replace("/onboarding");
    }
    if (mode === "onboarding" && state.venue.id) {
      router.replace("/dashboard");
    }
  }, [hydrated, isPending, mode, remote, router, session, state.venue.id]);

  if (
    remote &&
    (isPending ||
      !hydrated ||
      !session ||
      (mode === "dashboard" && !state.venue.id) ||
      (mode === "onboarding" && Boolean(state.venue.id)))
  ) {
    return <main className="public-loading">Chargement de votre espace…</main>;
  }

  return children;
}
