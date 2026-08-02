"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { MenuStoreProvider } from "@/lib/menu-store";

export function Providers({ children }: { children: ReactNode }) {
  const content = <MenuStoreProvider>{children}</MenuStoreProvider>;

  if (!convex) return content;

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient as unknown as AuthClient}
    >
      {content}
    </ConvexBetterAuthProvider>
  );
}
