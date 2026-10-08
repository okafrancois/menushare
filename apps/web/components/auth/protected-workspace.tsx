"use client";

import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { type ReactNode, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { workspaceDestination } from "@/lib/auth-navigation";
import { useMenuStore } from "@/lib/menu-store";

export function ProtectedWorkspace({
  children,
  mode,
  allowEmpty = false,
}: {
  children: ReactNode;
  mode: "dashboard" | "onboarding";
  allowEmpty?: boolean;
}) {
  const { remote, state, hydrated } = useMenuStore();
  const router = useRouter();
  const needsVenue =
    !remote &&
    hydrated &&
    !state.venue.id &&
    mode === "dashboard" &&
    !allowEmpty;
  useEffect(() => {
    if (needsVenue) router.replace("/onboarding");
  }, [needsVenue, router]);
  if (!remote)
    return needsVenue ? (
      <main className="public-loading">Chargement de votre espace…</main>
    ) : (
      children
    );
  return (
    <RemoteProtectedWorkspace mode={mode} allowEmpty={allowEmpty}>
      {children}
    </RemoteProtectedWorkspace>
  );
}

function RemoteProtectedWorkspace({
  children,
  mode,
  allowEmpty,
}: {
  children: ReactNode;
  mode: "dashboard" | "onboarding";
  allowEmpty: boolean;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const convexAuth = useConvexAuth();
  const { state, hydrated } = useMenuStore();
  const [authHandoffPending, setAuthHandoffPending] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("ott"),
  );

  useEffect(() => {
    if (!authHandoffPending) return;
    if (session || convexAuth.isAuthenticated) {
      setAuthHandoffPending(false);
      return;
    }
    const timeout = window.setTimeout(
      () => setAuthHandoffPending(false),
      8_000,
    );
    return () => window.clearTimeout(timeout);
  }, [authHandoffPending, convexAuth.isAuthenticated, session]);

  const destination = workspaceDestination({
    remote: true,
    sessionPending: isPending,
    convexLoading: convexAuth.isLoading,
    authHandoffPending,
    hydrated,
    hasSession: Boolean(session),
    convexAuthenticated: convexAuth.isAuthenticated,
    hasVenue: Boolean(state.venue.id) || allowEmpty,
    mode,
  });

  useEffect(() => {
    if (destination !== "render" && destination !== "wait") {
      router.replace(destination);
    }
  }, [destination, router]);

  if (destination !== "render") {
    return <main className="public-loading">Chargement de votre espace…</main>;
  }

  return children;
}
