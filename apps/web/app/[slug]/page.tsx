import type { Metadata } from "next";

import { PublicMenu } from "@/components/menu/public-menu";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug === "nonna-lydie" ? "Nonna Lydie" : "Menu public" };
}

export default async function PublicMenuPage({ params }: PageProps) {
  const { slug } = await params;
  return <PublicMenu slug={slug} />;
}
