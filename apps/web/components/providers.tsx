"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";

export function Providers({ children }: { children: ReactNode }) {
  if (!convex) return children;

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient as unknown as AuthClient}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
