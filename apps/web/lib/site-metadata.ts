export const SITE_NAME = "MenuShare";
export const SITE_TITLE = "MenuShare — Des menus vivants, en un scan";
export const SITE_DESCRIPTION =
  "Créez un menu visuel, publiez-le sur une URL unique et partagez-le par QR code.";

type PublicMenuSeo = {
  title: string;
  description: string;
  imageUrl?: string;
  isAvailable: boolean;
};

function cleanDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 157
    ? `${normalized.slice(0, 156).trimEnd()}…`
    : normalized;
}

export function buildPublicMenuSeo(
  slug: string,
  payload: unknown,
): PublicMenuSeo {
  if (payload && typeof payload === "object") {
    const venue = (payload as { venue?: unknown }).venue;
    if (venue && typeof venue === "object") {
      const candidate = venue as {
        name?: unknown;
        tagline?: unknown;
        description?: unknown;
        coverImageUrl?: unknown;
      };
      if (typeof candidate.name === "string" && candidate.name.trim()) {
        const name = candidate.name.trim();
        const suppliedDescription =
          typeof candidate.tagline === "string" && candidate.tagline.trim()
            ? candidate.tagline
            : typeof candidate.description === "string" &&
                candidate.description.trim()
              ? candidate.description
              : `Découvrez la carte de ${name}, ses plats, ses images et ses vidéos.`;
        return {
          title: `${name} — La carte`,
          description: cleanDescription(suppliedDescription),
          imageUrl:
            typeof candidate.coverImageUrl === "string" &&
            candidate.coverImageUrl.startsWith("http")
              ? candidate.coverImageUrl
              : undefined,
          isAvailable: true,
        };
      }
    }
  }

  if (slug === "nonna-lydie") {
    return {
      title: "Nonna Lydie — La carte",
      description:
        "Pâtes fraîches maison, sauces mijotées et produits d’Italie. Découvrez le menu vivant de Nonna Lydie.",
      isAvailable: true,
    };
  }

  return {
    title: "Menu indisponible",
    description: "Ce menu n’existe pas ou n’a pas encore été publié.",
    isAvailable: false,
  };
}
