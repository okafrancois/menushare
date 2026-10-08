"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { useMenuStore } from "@/lib/menu-store";

export function GettingStarted() {
  const { state } = useMenuStore();
  if (state.published) return null;
  const steps = [
    {
      label: "Ajouter une catégorie et vos premiers plats",
      href: "/dashboard/menu" as const,
      done: state.categories.some((c) => c.items.length),
    },
    {
      label: "Renseigner vos coordonnées et horaires",
      href: "/dashboard/settings" as const,
      done: Boolean(
        state.venue.address &&
        state.venue.openingHours?.some((d) => d.ranges.length),
      ),
    },
    {
      label: "Personnaliser votre carte",
      href: "/dashboard/appearance" as const,
      done: Boolean(state.venue.logoDataUrl || state.venue.coverImageDataUrl),
    },
    {
      label: "Prévisualiser, puis publier",
      href: "/preview" as const,
      done: false,
    },
  ];
  return (
    <section className="pro-card">
      <h2 className="pro-card-title">Votre première carte</h2>
      <p className="pro-hint">
        {steps.filter((s) => s.done).length} étapes sur 4 · Après publication,
        scannez votre QR avec un autre téléphone.
      </p>
      <div className="pro-journey">
        {steps.map((step) => (
          <Link
            href={step.href}
            key={step.href}
            className={step.done ? "done" : ""}
          >
            {step.done ? <Check size={18} /> : <Circle size={18} />}
            <span>{step.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
