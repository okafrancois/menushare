"use client";

import { ChevronLeft, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import { useModal } from "@/lib/use-modal";

/** Bottom sheet on phones, centred dialog on desktop. */
export function ProSheet({
  onClose,
  labelledBy,
  label,
  variant = "bottom",
  className = "",
  children,
}: {
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  variant?: "bottom" | "full";
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  useModal(panel, onClose);

  return (
    <div
      className={`pro-sheet-layer ${variant}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className={`pro-sheet ${variant} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}

export function SheetHead({
  id,
  title,
  onClose,
  subtitle,
}: {
  id: string;
  title: string;
  onClose: () => void;
  subtitle?: ReactNode;
}) {
  return (
    <header className="pro-sheet-head">
      <span className="pro-sheet-handle" aria-hidden="true" />
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <button
        className="pro-close"
        type="button"
        aria-label="Fermer"
        onClick={onClose}
      >
        <X size={18} />
      </button>
    </header>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="pro-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    />
  );
}

export function PageHead({
  eyebrow,
  title,
  back,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: string;
  back?: { href: Route; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="pro-page-head">
      <div>
        {back ? (
          <Link className="pro-back" href={back.href}>
            <ChevronLeft size={16} /> {back.label}
          </Link>
        ) : null}
        {eyebrow ? <span className="pro-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {children}
      </div>
      {actions ? <div className="pro-page-actions">{actions}</div> : null}
    </div>
  );
}

type ToastContextValue = (message: string) => void;
const ToastContext = createContext<ToastContextValue>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((next: string) => {
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pro-toast" role="status" aria-live="polite">
        {message ? <span>{message}</span> : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Human message for an error thrown by a store action. */
export function errorMessage(cause: unknown, fallback = "Action impossible, réessayez.") {
  const code = cause instanceof Error ? cause.message : "";
  const messages: Record<string, string> = {
    INVALID_PRICE: "Le prix est invalide.",
    INVALID_VIDEO_URL: "Utilisez une URL YouTube ou Vimeo valide.",
    UNSUPPORTED_VIDEO_PROVIDER: "Utilisez une URL YouTube ou Vimeo valide.",
    INVALID_IMAGE: "Image refusée : utilisez une image de moins de 2 Mo.",
    IMAGE_LIMIT_REACHED: "La galerie est limitée à 8 images.",
    IMAGE_UPLOAD_FAILED: "L’envoi de l’image a échoué.",
    SLUG_UNAVAILABLE: "Cette adresse de menu est déjà utilisée.",
    INVALID_SPECIAL: "Indiquez un nom de 80 caractères maximum.",
    INVALID_SPECIAL_END: "L’heure de fin doit être dans les 36 prochaines heures.",
    INVALID_OPENING_HOURS: "Vérifiez les horaires : une plage est invalide.",
    INVALID_COLOR: "Couleur invalide.",
  };
  if (messages[code]) return messages[code];
  // Convex wraps server errors: "[CONVEX …] Uncaught Error: CODE".
  const known = Object.keys(messages).find((key) => code.includes(key));
  if (known) return messages[known]!;
  return code && !code.startsWith("[") && code.length < 120 ? code : fallback;
}
