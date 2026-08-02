"use client";

import { Brand } from "@/components/brand";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { VenueForm } from "@/components/venue/venue-form";

export default function OnboardingPage() {
  return (
    <ProtectedWorkspace mode="onboarding">
      <main className="onboarding-page">
        <div className="onboarding-card">
          <Brand />
          <VenueForm />
        </div>
      </main>
    </ProtectedWorkspace>
  );
}
