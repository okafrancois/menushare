"use client";

import { useSyncExternalStore } from "react";
export const PRIVACY_KEY = "menushare.privacy.v1";
const EVENT = "menushare-privacy";
const LIFETIME = 180 * 24 * 60 * 60 * 1000;
type Preference = "analytics" | "videos";
function read(key: Preference) {
  try {
    const data = JSON.parse(localStorage.getItem(PRIVACY_KEY) ?? "null");
    return data?.[key] === true && Date.now() - data.at < LIFETIME;
  } catch {
    return false;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}
export function usePrivacyPreference(key: Preference) {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
}
export function useHasPrivacyChoice() {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        const data = JSON.parse(localStorage.getItem(PRIVACY_KEY) ?? "null");
        return (
          typeof data?.analytics === "boolean" &&
          Date.now() - data.at < LIFETIME
        );
      } catch {
        return false;
      }
    },
    () => false,
  );
}
export function setPrivacyPreference(key: Preference, enabled: boolean) {
  const preferences = {
    analytics: read("analytics"),
    videos: read("videos"),
    [key]: enabled,
    at: Date.now(),
  };
  try {
    localStorage.setItem(PRIVACY_KEY, JSON.stringify(preferences));
    if (key === "analytics" && !enabled) {
      for (const name of Object.keys(localStorage))
        if (name.startsWith("menushare.visitor."))
          localStorage.removeItem(name);
    }
  } catch {
    throw new Error(
      "Votre navigateur ne permet pas d’enregistrer ce choix. Les options restent désactivées.",
    );
  }
  window.dispatchEvent(new Event(EVENT));
}
