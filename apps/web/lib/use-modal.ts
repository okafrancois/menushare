"use client";

import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Makes everything outside `element` inert (unfocusable and hidden from
 * assistive technologies), except live regions so toasts are still
 * announced. Returns a function restoring the previous state.
 */
export function inertOutside(element: HTMLElement) {
  const changed: HTMLElement[] = [];
  let node: HTMLElement | null = element;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (sibling.inert) continue;
      if (sibling.matches('[aria-live], [role="status"], script, style')) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const sibling of changed) sibling.inert = false;
  };
}

function focusables(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getClientRects().length > 0,
  );
}

/**
 * Modal behaviour shared by every sheet: scroll lock, initial focus
 * (`[data-autofocus]` first), focus kept inside with Tab, Escape to close,
 * inert background, and focus given back to the opener on close.
 */
export function useModal(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = element.parentElement ?? element;
    const restoreInert = inertOutside(layer);

    const initial =
      element.querySelector<HTMLElement>("[data-autofocus]") ??
      focusables(element)[0] ??
      element;
    initial.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables(element);
      if (!items.length) {
        event.preventDefault();
        element.focus();
        return;
      }
      const first = items[0]!;
      const last = items.at(-1)!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !element.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !element.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreInert();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [panel]);
}
