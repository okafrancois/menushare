"use client";

import { X } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { useModal } from "@/lib/use-modal";

/**
 * Modal panel of the public menu: a bottom sheet on phones, centred in the
 * menu column on larger screens. Modal behaviour comes from `useModal`.
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
  useModal(panel, onClose);

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
