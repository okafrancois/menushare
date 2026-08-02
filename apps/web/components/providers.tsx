"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { MenuStoreProvider } from "@/lib/menu-store";
import { RemoteMenuStoreProvider } from "@/lib/remote-menu-store";

export function Providers({ children }: { children: ReactNode }) {
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
