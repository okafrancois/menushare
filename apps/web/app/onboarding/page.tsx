"use client";

import { Brand } from "@/components/brand";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { VenueForm } from "@/components/venue/venue-form";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <ProtectedWorkspace mode="onboarding">
      <main className="onboarding-page">
        <div className="onboarding-card">
          <Brand />
          <VenueForm />
          <div className="pro-utility-links">
            <Link href="/help">Besoin d’aide ?</Link>
            <Link href="/dashboard/account">Mon compte</Link>
          </div>
        </div>
      </main>
    </ProtectedWorkspace>
  );
}
