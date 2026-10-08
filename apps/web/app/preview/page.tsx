"use client";

import Link from "next/link";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { PublishedMenu } from "@/components/menu/public-menu";
import { useMenuStore } from "@/lib/menu-store";

function DraftPreview() {
  const { state, hydrated } = useMenuStore();
  if (!hydrated)
    return <main className="public-loading">Chargement de l’aperçu…</main>;
  return (
    <>
      <div className="preview-notice">
        <strong>Aperçu du brouillon</strong>
        <span>Visible uniquement par vous</span>
        <Link href="/dashboard/menu">Retour à l’édition</Link>
      </div>
      <PublishedMenu
        key={state.venue.id}
        snapshot={{
          venue: state.venue,
          categories: state.categories,
          version: 0,
          publishedAt: 0,
        }}
        live={state.live}
        popularIds={[]}
        preview
      />
    </>
  );
}
export default function PreviewPage() {
  return (
    <ProtectedWorkspace mode="dashboard">
      <DraftPreview />
    </ProtectedWorkspace>
  );
}
