import type { Metadata } from "next";
import { api } from "@repo/backend/api";
import { fetchQuery } from "convex/nextjs";

import { PublicMenu } from "@/components/menu/public-menu";
import { buildPublicMenuSeo } from "@/lib/site-metadata";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let payload: unknown = null;

  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    try {
      payload = await fetchQuery(api.menus.getPublishedBySlug, { slug });
    } catch {
      // The public page still renders its local fallback when Convex is offline.
    }
  }

  const seo = buildPublicMenuSeo(slug, payload);
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/menu/${slug}` },
    robots: seo.isAvailable ? undefined : { index: false, follow: false },
    openGraph: {
      type: "website",
      url: `/menu/${slug}`,
      title: seo.title,
      description: seo.description,
      images: seo.imageUrl ? [{ url: seo.imageUrl }] : undefined,
    },
  };
}

export default async function PublicMenuPage({ params }: PageProps) {
  const { slug } = await params;
  return <PublicMenu slug={slug} />;
}
