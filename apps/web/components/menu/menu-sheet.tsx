"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * Modal panel of the public menu: a bottom sheet on phones, centred in the
 * menu column on larger screens. Closes on Escape and on the backdrop, locks
 * the page scroll and gives focus back to the opener.
 */
export function Sheet({
  onClose,
  label,
  labelledBy,
  variant = "bottom",
  className = "",
  children,
}: {
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  variant?: "bottom" | "full" | "night";
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>("input, button, a[href]");
    (focusable ?? panel.current)?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className={`pm-sheet-layer ${variant}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className={`pm-sheet ${variant} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}

export function SheetHeader({
  id,
  title,
  onClose,
  children,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="pm-sheet-head">
      <span className="pm-sheet-handle" aria-hidden="true" />
      <div className="pm-sheet-title">
        <h2 id={id}>{title}</h2>
        {children}
      </div>
      <CloseButton onClose={onClose} />
    </header>
  );
}

export function CloseButton({
  onClose,
  className = "pm-close",
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      className={className}
      type="button"
      aria-label="Fermer"
      data-autofocus
      onClick={onClose}
    >
      <X size={18} />
    </button>
  );
}
