export type ExternalVideo = {
  provider: "youtube" | "vimeo";
  externalId: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  video?: ExternalVideo;
};

export type MenuCategory = {
  id: string;
  name: string;
  eyebrow: string;
  items: MenuItem[];
};

export const demoVenue = {
  slug: "nonna-lydie",
  name: "Nonna Lydie",
  kind: "Trattoria",
  city: "Bordeaux",
  tagline: "Pâtes fraîches maison, sauces mijotées, produits d’Italie.",
  description:
    "Chez Nonna Lydie, on cuisine comme à la maison : pâtes fraîches roulées le matin, sauces mijotées lentement et produits venus directement d’Italie.",
  phone: "05 56 00 00 00",
  hours: "Mardi — Samedi · 12h—14h30 & 19h—22h30",
  categories: [
    {
      id: "antipasti",
      name: "Antipasti",
      eyebrow: "Pour commencer",
      items: [
        {
          id: "burrata",
          name: "Burrata Pugliese",
          description: "Burrata 125 g des Pouilles, tomates confites au basilic.",
          priceCents: 1400,
        },
        {
          id: "vitello",
          name: "Vitello Tonnato",
          description: "Veau rosé en fines tranches, crème de thon et câpres.",
          priceCents: 1300,
        },
      ],
    },
    {
      id: "primi",
      name: "Primi & Secondi",
      eyebrow: "Le cœur du repas",
      items: [
        {
          id: "tagliatelle",
          name: "Tagliatelle al Tartufo",
          description: "Pâtes fraîches du jour, crème de truffe, parmesan 24 mois.",
          priceCents: 2400,
          video: { provider: "youtube", externalId: "demo" },
        },
        {
          id: "lasagne",
          name: "Lasagne della Nonna",
          description: "Ragù de bœuf mijoté 6 h, béchamel et mozzarella gratinée.",
          priceCents: 1900,
        },
        {
          id: "osso-buco",
          name: "Osso Buco alla Milanese",
          description: "Jarret de veau confit, gremolata et risotto safrané.",
          priceCents: 2700,
        },
      ],
    },
    {
      id: "dolci",
      name: "Dolci",
      eyebrow: "La note finale",
      items: [
        {
          id: "tiramisu",
          name: "Tiramisù della Casa",
          description: "Mascarpone monté minute, biscuits imbibés d’espresso.",
          priceCents: 900,
        },
        {
          id: "cannoli",
          name: "Cannoli Siciliani",
          description: "Coques croustillantes, ricotta de brebis, pistache de Bronte.",
          priceCents: 800,
        },
      ],
    },
  ] satisfies MenuCategory[],
};

export function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

