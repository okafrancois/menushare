import { describe, expect, it } from "vitest";

import { signedInDestination, workspaceDestination } from "./auth-navigation";

const protectedDefaults = {
  remote: true,
  sessionPending: false,
  convexLoading: false,
  authHandoffPending: false,
  hydrated: true,
  hasSession: false,
  convexAuthenticated: false,
  hasVenue: false,
  mode: "onboarding" as const,
};

describe("workspaceDestination", () => {
  it("attend la remise de session OAuth Apple avant toute redirection", () => {
    expect(
      workspaceDestination({
        ...protectedDefaults,
        authHandoffPending: true,
      }),
    ).toBe("wait");
  });

  it("accepte l'authentification Convex même si la session client se resynchronise", () => {
    expect(
      workspaceDestination({
        ...protectedDefaults,
        convexAuthenticated: true,
      }),
    ).toBe("render");
  });

  it("envoie un utilisateur authentifié sans établissement vers l'onboarding", () => {
    expect(
      workspaceDestination({
        ...protectedDefaults,
        mode: "dashboard",
        hasSession: true,
      }),
    ).toBe("/onboarding");
  });
});

describe("signedInDestination", () => {
  it("sort un utilisateur Apple déjà connecté de la page de connexion", () => {
    expect(
      signedInDestination({
        remote: true,
        sessionPending: false,
        hydrated: true,
        hasSession: true,
        hasVenue: false,
      }),
    ).toBe("/onboarding");
  });
});
