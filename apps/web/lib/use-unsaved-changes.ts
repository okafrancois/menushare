"use client";

import { useEffect, useRef } from "react";

const guards = new Set<() => boolean>();
const confirmedClicks = new WeakSet<MouseEvent>();
export function confirmNavigation() {
  return (
    ![...guards].some((isDirty) => isDirty()) ||
    window.confirm("Abandonner les modifications non enregistrées ?")
  );
}

/** Protect both document navigation and Next links; venue switches use the same guard. */
export function useUnsavedChanges(dirty: boolean) {
  const current = useRef(dirty);
  current.current = dirty;
  useEffect(() => {
    const guard = () => current.current;
    guards.add(guard);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!current.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (
        !current.current ||
        !link ||
        event.defaultPrevented ||
        confirmedClicks.has(event) ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        link.getAttribute("target") === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      confirmedClicks.add(event);
      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      guards.delete(guard);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, []);
}
