"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { MenuStoreProvider } from "@/lib/menu-store";
import { RemoteMenuStoreProvider } from "@/lib/remote-menu-store";

export function Providers({ children }: { children: ReactNode }) {
  if (
    !convex &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  ) {
    return (
      <main className="public-not-found">
        <h1>MenuShare est temporairement indisponible.</h1>
        <p>
          Le service n’est pas prêt à recevoir des modifications. Réessayez plus
          tard.
        </p>
      </main>
    );
  }
  if (!convex) return <MenuStoreProvider>{children}</MenuStoreProvider>;

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient as unknown as AuthClient}
    >
      <RemoteMenuStoreProvider>{children}</RemoteMenuStoreProvider>
    </ConvexBetterAuthProvider>
  );
}
