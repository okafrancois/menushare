export type WorkspaceDestination =
  "render" | "wait" | "/sign-in" | "/onboarding" | "/dashboard";

export function workspaceDestination({
  remote,
  sessionPending,
  convexLoading,
  authHandoffPending,
  hydrated,
  hasSession,
  convexAuthenticated,
  hasVenue,
  mode,
}: {
  remote: boolean;
  sessionPending: boolean;
  convexLoading: boolean;
  authHandoffPending: boolean;
  hydrated: boolean;
  hasSession: boolean;
  convexAuthenticated: boolean;
  hasVenue: boolean;
  mode: "dashboard" | "onboarding";
}): WorkspaceDestination {
  if (!remote) return "render";
  if (sessionPending || convexLoading || authHandoffPending || !hydrated) {
    return "wait";
  }
  if (!hasSession && !convexAuthenticated) return "/sign-in";
  if (mode === "dashboard" && !hasVenue) return "/onboarding";
  if (mode === "onboarding" && hasVenue) return "/dashboard";
  return "render";
}

export function signedInDestination({
  remote,
  sessionPending,
  hydrated,
  hasSession,
  hasVenue,
}: {
  remote: boolean;
  sessionPending: boolean;
  hydrated: boolean;
  hasSession: boolean;
  hasVenue: boolean;
}) {
  if (!remote || sessionPending || !hydrated || !hasSession) return null;
  return hasVenue ? "/dashboard" : "/onboarding";
}
