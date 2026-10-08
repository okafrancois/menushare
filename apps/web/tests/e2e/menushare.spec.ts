import { expect, test, type Page } from "@playwright/test";

const tinySvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#d97757"/></svg>',
);
const secondTinySvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#76263c"/></svg>',
);

// Thursday 8 October 2026, 13:00 in Paris: the demo trattoria is open.
const THURSDAY_LUNCH = new Date("2026-10-08T13:00:00+02:00");

const EXTERNAL_PLAYER_HOST =
  /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|vimeocdn\.com)$/;

// Only third-party hosts: bundled player SDK chunks are served locally.
async function blockExternalPlayers(page: Page) {
  await page.route(
    (url) => EXTERNAL_PLAYER_HOST.test(url.hostname),
    (route) => route.abort(),
  );
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

function publishBar(page: Page) {
  return page.getByRole("region", { name: "Publication" });
}

async function publish(page: Page) {
  await publishBar(page)
    .getByRole("button", { name: "Publier", exact: true })
    .click();
  await expect(publishBar(page)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await blockExternalPlayers(page);
  page.on("pageerror", (error) =>
    console.error(`[browser page error] ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error(`[browser console] ${message.text()}`);
  });
});

test("identité navigateur, favicon et titres propres à chaque page", async ({
  page,
}) => {
  const routes = [
    ["/", "MenuShare — Des menus vivants, en un scan"],
    ["/sign-in", "Connexion et inscription · MenuShare"],
    ["/onboarding", "Créer votre premier établissement · MenuShare"],
    ["/dashboard", "Service · MenuShare"],
    ["/dashboard/menu", "La carte · MenuShare"],
    ["/dashboard/stats", "Statistiques · MenuShare"],
    ["/dashboard/venue", "Établissement · MenuShare"],
    ["/dashboard/appearance", "Apparence de la carte · MenuShare"],
    ["/dashboard/settings", "Informations de l’établissement · MenuShare"],
    ["/dashboard/share", "QR codes et tables · MenuShare"],
    ["/dashboard/establishments/new", "Nouvel établissement · MenuShare"],
    ["/menu/nonna-lydie", "Nonna Lydie — La carte · MenuShare"],
    ["/menu/inconnu", "Menu indisponible · MenuShare"],
  ] as const;

  for (const [route, title] of routes) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
  }

  await page.goto("/");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /icon\.svg/,
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator(".brand-mark")).toHaveAttribute("src", "/icon.svg");
});

test("accueil, connexion sans mot de passe et redirection inscription", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Votre menu prend vie/i }),
  ).toBeVisible();
  await expect(page.getByText("Sans mot de passe")).toBeVisible();
  await page
    .getByRole("link", { name: /Commencer/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("button", { name: "Continuer avec Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuer avec Apple" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Recevoir mon code" }),
  ).toBeVisible();
  await expect(page.locator(".auth-art .brand small")).toHaveCSS(
    "color",
    "rgba(255, 255, 255, 0.86)",
  );
  await expect(page.locator(".auth-art .brand small")).toHaveCSS(
    "font-weight",
    "700",
  );
  await page.getByRole("button", { name: "Continuer avec Google" }).click();
  await expect(page.locator(".form-error")).toContainText("identifiants OAuth");
  await page.goto("/sign-up");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("onboarding puis création complète d’un plat publié", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Nom de l’établissement").fill("Bistro des Tests");
  await expect(page.getByLabel("Adresse du menu")).toHaveValue(
    "bistro-des-tests",
  );
  await page.getByLabel("Type").selectOption("Café");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByRole("button", { name: "Créer mon menu" }).click();
  await expect(page).toHaveURL(/\/dashboard\/menu$/);
  await expect(page.getByText("Votre carte est vide")).toBeVisible();

  await page.getByRole("button", { name: "Créer une catégorie" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Brunch");
  await page.getByLabel("Sous-titre").fill("Toute la journée");
  await page.getByRole("button", { name: "Ajouter la catégorie" }).click();
  await expect(page.getByRole("heading", { name: "Brunch" })).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un plat" }).click();
  const editor = page.getByRole("dialog", { name: "Nouveau plat" });
  await editor.getByLabel("Nom du plat").fill("Œufs bénédicte");
  await editor.getByLabel("Prix (€)").fill("16,50");
  await editor
    .getByLabel("Description courte")
    .fill("Œufs pochés, brioche et sauce hollandaise.");
  const allergens = editor.getByRole("group", { name: "Allergènes du plat" });
  for (const allergen of ["Gluten", "Œufs", "Lait"])
    await allergens.getByRole("button", { name: allergen }).click();
  await editor
    .getByRole("group", { name: "Régime et badges" })
    .getByRole("button", { name: "Végétarien" })
    .click();
  await editor.getByTestId("item-images-input").setInputFiles([
    { name: "oeufs.svg", mimeType: "image/svg+xml", buffer: tinySvg },
    {
      name: "oeufs-detail.svg",
      mimeType: "image/svg+xml",
      buffer: secondTinySvg,
    },
  ]);
  await expect(editor.getByRole("img", { name: "oeufs.svg" })).toBeVisible();
  await editor.getByText("Fiche détaillée").click();
  await editor
    .getByLabel("Description complète de la fiche")
    .fill("Des œufs fermiers pochés minute sur une brioche toastée.");
  await editor
    .getByLabel("Vidéo YouTube ou Vimeo")
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await editor
    .getByLabel("Ingrédients")
    .fill("Œufs fermiers\nBrioche toastée\nSauce hollandaise");
  await editor
    .getByLabel("Accord ou accompagnement")
    .fill("Mimosa à l’orange fraîche");
  await editor.getByLabel("Prix de l’accord (€)").fill("8");
  await editor.getByLabel("Note client (sur 5)").fill("4,9");
  await editor.getByLabel("Nombre d’avis").fill("42");
  await editor
    .getByLabel("Avis mis en avant")
    .fill("Le brunch parfait du dimanche.");
  await editor.getByLabel("Auteur de l’avis").fill("Léa M.");
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Modifier Œufs bénédicte" }),
  ).toBeVisible();

  await expect(publishBar(page)).toContainText("pas encore en ligne");
  await publish(page);
  await expect(page.getByText(/En ligne · v1/).first()).toBeVisible();

  await page.goto("/dashboard/share");
  await expect(page.getByTestId("qr-code").locator("svg")).toBeVisible();
  await expect(page.getByText(/bistro-des-tests/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger en SVG" }).click();
  await expect((await download).suggestedFilename()).toBe(
    "qr-bistro-des-tests.svg",
  );

  await page.goto("/menu/bistro-des-tests");
  await expect(
    page.getByRole("heading", { name: "Bistro des Tests", level: 1 }),
  ).toBeVisible();
  expect((await page.locator("main.public-menu").boundingBox())?.width).toBe(
    480,
  );
  await page.getByRole("button", { name: "Voir Œufs bénédicte" }).click();
  const sheet = page.getByRole("dialog", { name: "Œufs bénédicte" });
  await expect(sheet.getByRole("img", { name: "oeufs.svg" })).toBeVisible();
  await expect(sheet).toContainText("Des œufs fermiers pochés minute");
  await expect(sheet).toContainText("Végétarien");
  for (const allergen of ["Gluten", "Œufs", "Lait"])
    await expect(sheet.getByRole("listitem").filter({ hasText: allergen })).toBeVisible();
  await expect(sheet).toContainText("Œufs fermiers · Brioche toastée");
  await expect(sheet).toContainText("Mimosa à l’orange fraîche");
  await expect(sheet).toContainText("4,9/5");
  await expect(sheet).toContainText("Le brunch parfait du dimanche.");
  await expect(page.getByRole("button", { name: "Commander" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Afficher le média 3" }).click();
  await sheet
    .getByRole("button", { name: "Lire la vidéo de Œufs bénédicte" })
    .click();
  await expect(sheet.getByTestId("video-frame")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed/,
  );
});

test("carte : ordre, rupture en direct, prix publié et suppression", async ({
  page,
}) => {
  await page.goto("/dashboard/menu");
  const categoryTitles = page.locator(".pro-category h2");
  await expect(categoryTitles.first()).toHaveText("Antipasti");
  await page.getByRole("button", { name: "Réorganiser" }).click();
  await page.getByRole("button", { name: "Descendre Antipasti" }).click();
  await expect(categoryTitles.nth(1)).toHaveText("Antipasti");
  await page.getByRole("button", { name: "Terminer" }).click();

  // A sold-out dish is shown as such right away, without publishing.
  await page
    .getByRole("switch", { name: "Disponibilité de Burrata Pugliese" })
    .click();
  await expect(
    page.getByRole("switch", { name: "Disponibilité de Burrata Pugliese" }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(publishBar(page)).toContainText("1 modification");

  await page.getByRole("button", { name: "Modifier Burrata Pugliese" }).click();
  const editor = page.getByRole("dialog", { name: "Modifier le plat" });
  await editor.getByLabel("Prix (€)").fill("15");
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  await expect(publishBar(page)).toContainText("2 modifications");
  await publishBar(page).getByRole("button", { name: /modifications en attente/ }).click();
  const review = page.getByRole("dialog", { name: "2 modifications en attente" });
  await expect(review).toContainText("Ordre des catégories");
  await expect(review).toContainText(/Prix 14\s€ → 15\s€/);

  await page.goto("/menu/nonna-lydie");
  const burrata = page
    .locator(".pm-category")
    .getByRole("button", { name: "Voir Burrata Pugliese" });
  await expect(burrata).toContainText("Épuisé");

  // Back in stock: still the published price until the draft is published.
  await page.goto("/dashboard/menu");
  await page
    .getByRole("switch", { name: "Disponibilité de Burrata Pugliese" })
    .click();
  await page.goto("/menu/nonna-lydie");
  await expect(burrata).not.toContainText("Épuisé");
  await expect(burrata).toContainText(/14\s€/);
  expect(await page.locator(".pm-category h2").allTextContents()).toEqual([
    "Antipasti",
    "Primi & Secondi",
    "Dolci",
    "À boire",
  ]);

  await page.goto("/dashboard/menu");
  await publish(page);
  await page.goto("/menu/nonna-lydie");
  await expect(burrata).toContainText(/15\s€/);
  expect(await page.locator(".pm-category h2").allTextContents()).toEqual([
    "Primi & Secondi",
    "Antipasti",
    "Dolci",
    "À boire",
  ]);

  await page.goto("/dashboard/menu");
  await page.getByRole("button", { name: "Modifier Vitello Tonnato" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer ce plat" }).click();
  await expect(
    page.getByRole("button", { name: "Modifier Vitello Tonnato" }),
  ).toHaveCount(0);
  await expect(publishBar(page)).toContainText("1 modification");
});

test("service : disponibilité et suggestion du jour en direct", async ({
  page,
}) => {
  await page.clock.setFixedTime(THURSDAY_LUNCH);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Bonjour, Nonna Lydie" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Disponibilité ce midi" })).toBeVisible();

  await page
    .getByRole("switch", { name: "Disponibilité de Arancini al Ragù" })
    .click();
  await page
    .getByRole("switch", { name: "Disponibilité de Tagliatelle al Tartufo" })
    .click();

  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const special = page.getByRole("dialog", { name: "Suggestion du jour" });
  await special.getByLabel("Nom", { exact: true }).fill("Gnocchi al pesto");
  await special.getByLabel("Prix (€)").fill("18");
  await special.getByLabel("Description").fill("Pesto de basilic, pignons.");
  await special.getByLabel("Retirer de la carte à").fill("22:30");
  await special.getByRole("button", { name: "Mettre en ligne maintenant" }).click();
  await expect(page.getByText("Gnocchi al pesto", { exact: true })).toBeVisible();
  await expect(publishBar(page)).toHaveCount(0);

  await page.goto("/menu/nonna-lydie");
  const suggestion = page.getByRole("region", { name: "Suggestion du jour" });
  await expect(suggestion).toContainText("Gnocchi al pesto");
  await expect(suggestion).toContainText(/18\s€/);
  await expect(
    page.locator(".pm-category").getByRole("button", { name: "Voir Tagliatelle al Tartufo" }),
  ).toContainText("Épuisé");
  await expect(
    page.locator(".pm-category").getByRole("button", { name: "Voir Arancini al Ragù" }),
  ).not.toContainText("Épuisé");

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  await page.goto("/menu/nonna-lydie");
  await expect(page.getByRole("region", { name: "Suggestion du jour" })).toHaveCount(0);
});

test("apparence, logo, couverture et lecteur vidéo Vimeo", async ({ page }) => {
  await page.goto("/dashboard/appearance");
  await page.getByLabel("Code couleur").fill("#125c4a");
  await page.getByTestId("logo-input").setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: tinySvg,
  });
  await page.getByTestId("cover-input").setInputFiles({
    name: "cover.svg",
    mimeType: "image/svg+xml",
    buffer: tinySvg,
  });
  await expect(page.getByRole("img", { name: "Logo actuel" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Couverture actuelle" }),
  ).toBeVisible();
  await page
    .getByLabel("URL de la vidéo de couverture")
    .fill("https://vimeo.com/76979871");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Vidéo enregistrée · à publier").first()).toBeVisible();
  await publishBar(page).getByRole("button", { name: /en attente/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Couleur, logo, couverture, vidéo de couverture",
  );
  await page.getByRole("button", { name: "Publier la version 2" }).click();

  await page.goto("/menu/nonna-lydie");
  await expect(page.getByRole("img", { name: "Logo Nonna Lydie" })).toBeVisible();
  await expect(page.locator("main.public-menu")).toHaveCSS(
    "--accent",
    "#125c4a",
  );
  await page
    .getByRole("button", { name: "Lire la vidéo de couverture" })
    .click();
  await expect(page.getByTestId("video-frame")).toHaveAttribute(
    "src",
    /player\.vimeo\.com\/video\/76979871/,
  );
});

test("informations et horaires restent en brouillon jusqu’à la publication", async ({
  page,
}) => {
  await page.clock.setFixedTime(THURSDAY_LUNCH);
  await page.goto("/dashboard/settings");
  await page.getByLabel("Nom", { exact: true }).fill("Nonna Lydie Nouveau");
  await page
    .getByLabel("Phrase d’accroche")
    .fill("Une nouvelle promesse encore en brouillon.");
  await page.getByRole("switch", { name: "Lundi ouvert" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByText("Modifications enregistrées · visibles après publication."),
  ).toBeVisible();

  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Nonna Lydie", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Une nouvelle promesse encore en brouillon."),
  ).toHaveCount(0);

  await page.goto("/dashboard/settings");
  await publishBar(page).getByRole("button", { name: /en attente/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Nom, accroche, horaires d’ouverture",
  );
  await page.getByRole("button", { name: /Publier la version/ }).click();

  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Nonna Lydie Nouveau" }),
  ).toBeVisible();
  await expect(
    page.getByText("Une nouvelle promesse encore en brouillon."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Infos pratiques" }).click();
  const info = page.getByRole("dialog", { name: "Nonna Lydie Nouveau" });
  await expect(info.getByRole("listitem").first()).toContainText(
    "Lundi12h–14h30 · 19h–22h30",
  );
  await expect(info.locator(".today")).toContainText("Jeudi · aujourd’hui");
});

test("menu public mobile : table, filtres, recherche, sélection et serveur", async ({
  page,
}) => {
  await page.clock.setFixedTime(THURSDAY_LUNCH);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/nonna-lydie?t=12");
  await expect(page.getByRole("heading", { name: "Nonna Lydie" })).toBeVisible();
  await expect(page.getByText("Table 12")).toBeVisible();
  await expect(page.getByText("Ouvert · jusqu’à 14h30")).toBeVisible();
  await expect(page.getByRole("link", { name: "Itinéraire" })).toHaveCount(0);
  expect((await page.locator("main.public-menu").boundingBox())?.width).toBe(
    390,
  );
  await noHorizontalOverflow(page);

  // The first screen already shows dishes and the suggestion of the day.
  const suggestion = page.getByRole("region", { name: "Suggestion du jour" });
  await expect(suggestion).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "Les plus consultés" }),
  ).toBeInViewport();

  // Category tabs stay pinned while reading.
  await page
    .getByRole("navigation", { name: "Catégories du menu" })
    .getByRole("button", { name: "Dolci" })
    .click();
  await expect(page.getByRole("heading", { name: "Dolci", level: 2 })).toBeInViewport();
  await expect(
    page.getByRole("navigation", { name: "Catégories du menu" }),
  ).toBeInViewport();

  // Avoiding milk hides the dishes that contain it or are not documented.
  await page.getByRole("button", { name: "Allergies" }).click();
  const allergies = page.getByRole("dialog", { name: "Allergies et régimes" });
  await allergies.getByRole("button", { name: "Lait" }).click();
  await allergies.getByRole("button", { name: "Voir 5 plats" }).click();
  await expect(page.getByRole("status").filter({ hasText: "masqués" })).toContainText(
    "sans lait",
  );
  await expect(page.locator(".pm-category").getByText("Burrata Pugliese")).toHaveCount(0);
  await expect(page.locator(".pm-category").getByText("Vitello Tonnato")).toBeVisible();
  await page.getByRole("button", { name: "Tout voir" }).click();
  await expect(page.locator(".pm-category").getByText("Burrata Pugliese")).toBeVisible();

  await page.getByRole("button", { name: "Rechercher un plat" }).click();
  await page.getByRole("searchbox").fill("truffe");
  await expect(page.getByRole("dialog")).toContainText("1 résultat");
  await page.getByRole("dialog").getByRole("button", { name: "Voir Tagliatelle al Tartufo" }).click();
  const dish = page.getByRole("dialog", { name: "Tagliatelle al Tartufo" });
  await expect(dish).toContainText("Contient lait, que vous évitez.");
  await dish.getByRole("button", { name: "Augmenter la quantité" }).click();
  await dish.getByRole("button", { name: /Ajouter à ma sélection/ }).click();

  await page
    .locator(".pm-category")
    .getByRole("button", { name: "Ajouter Burrata Pugliese à ma sélection" })
    .click();
  const pill = page.getByRole("button", { name: /Ouvrir ma sélection : 3 articles/ });
  await expect(pill).toContainText(/62\s€/);
  await pill.click();
  await page.getByRole("button", { name: "Montrer au serveur" }).click();
  const waiter = page.getByRole("dialog", { name: "Sélection pour le serveur" });
  await expect(waiter).toContainText("Table 12");
  await expect(waiter).toContainText("2×Tagliatelle al Tartufo");
  await expect(waiter).toContainText("1×Burrata Pugliese");

  // The memo survives a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: /Ouvrir ma sélection : 3 articles/ })).toBeVisible();

  await page.goto("/ce-menu-nexiste-pas");
  await expect(
    page.getByRole("heading", { name: "Cette table est encore vide." }),
  ).toBeVisible();
});

test("menu public : lien direct, infos pratiques, partage et mode sombre", async ({
  page,
}) => {
  await page.clock.setFixedTime(THURSDAY_LUNCH);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/nonna-lydie");
  await expect(page.getByText("Table 12")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Itinéraire" })).toHaveAttribute(
    "href",
    /google\.com\/maps\/search\/\?api=1&query=12%20rue%20des%20Remparts/,
  );
  await expect(page.getByRole("link", { name: "Appeler" })).toHaveAttribute(
    "href",
    "tel:0556000000",
  );
  await page.getByRole("button", { name: "Horaires" }).click();
  await expect(page.getByRole("dialog", { name: "Nonna Lydie" })).toContainText(
    "Fermé le dimanche et le lundi.",
  );
  await page.keyboard.press("Escape");

  // A selection shared by a friend opens directly.
  await page.goto("/menu/nonna-lydie?sel=burrata~2.tiramisu~1");
  const selection = page.getByRole("dialog", { name: "Ma sélection" });
  await expect(selection).toContainText("Burrata Pugliese");
  await expect(selection).toContainText(/37\s€/);
  await expect(page).toHaveURL(/\/menu\/nonna-lydie$/);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/menu/nonna-lydie");
  await expect(page.locator("main.public-menu")).toHaveCSS(
    "background-color",
    "rgb(20, 16, 16)",
  );
});

test("navigation mobile du tableau de bord et onglet Établissement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const tabs = page.getByRole("navigation", {
    name: "Navigation du tableau de bord",
  });
  await expect(tabs).toBeVisible();
  for (const label of ["Service", "Carte", "Stats", "Établissement"])
    await expect(tabs.getByRole("link", { name: label })).toBeVisible();
  await noHorizontalOverflow(page);

  await tabs.getByRole("link", { name: "Établissement" }).click();
  await expect(page).toHaveURL(/\/dashboard\/venue$/);
  await expect(tabs.getByRole("link", { name: "Établissement" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: /^Apparence/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/appearance$/);
  await page.getByRole("link", { name: "Établissement" }).first().click();
  await page.getByRole("link", { name: /^Informations/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await noHorizontalOverflow(page);

  for (const route of [
    "/dashboard",
    "/dashboard/menu",
    "/dashboard/stats",
    "/dashboard/venue",
    "/dashboard/share",
    "/dashboard/share/tables",
    "/dashboard/appearance",
    "/dashboard/settings",
    "/dashboard/establishments/new",
  ]) {
    await page.goto(route);
    await expect(page.locator(".pro-page-head h1")).toBeVisible();
    await noHorizontalOverflow(page);
  }

  await tabs.getByRole("link", { name: "Carte" }).click();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Ajouter" })).toContainText(
    "La suggestion du jour",
  );
});

test("plusieurs établissements et ancienne URL publique", async ({ page }) => {
  await page.goto("/nonna-lydie");
  await expect(page).toHaveURL(/\/menu\/nonna-lydie$/);

  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: /Établissement actif : Nonna Lydie/ })
    .click();
  await page
    .getByRole("dialog", { name: "Mes établissements" })
    .getByRole("link", { name: "Ajouter un établissement" })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/establishments\/new$/);
  await page.getByLabel("Nom de l’établissement").fill("Deuxième Adresse");
  await page.getByLabel("Ville").fill("Paris");
  await page.getByRole("button", { name: "Créer cet établissement" }).click();
  await expect(page).toHaveURL(/\/dashboard\/menu$/);

  await page
    .getByRole("button", { name: /Établissement actif : Deuxième Adresse/ })
    .click();
  const venues = page.getByRole("dialog", { name: "Mes établissements" });
  await expect(venues.getByRole("listitem")).toHaveCount(2);
  await venues.getByRole("button", { name: /Nonna Lydie/ }).click();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Nonna Lydie/, level: 1 })).toBeVisible();
});

test("QR codes par table et statistiques en mode démo", async ({ page }) => {
  await page.goto("/dashboard/share");
  await page.getByLabel("Nombre de tables").fill("3");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(publishBar(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Imprimer les 3 QR codes" }).click();
  await expect(page).toHaveTitle("QR codes des tables · MenuShare");
  const sheet = page.getByTestId("table-qr-sheet");
  await expect(sheet.locator("svg")).toHaveCount(3);
  await expect(sheet.getByText("Table 3")).toBeVisible();

  await page.goto("/dashboard/stats");
  await expect(
    page.getByRole("heading", { name: "Statistiques", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Aucune statistique en mode démo.")).toBeVisible();
  await page.getByRole("button", { name: "30 jours" }).click();
  await expect(page.getByRole("button", { name: "30 jours" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("carte : réorganiser un plat au glisser-déposer", async ({ page }) => {
  await page.goto("/dashboard/menu");
  await page.getByRole("button", { name: "Réorganiser" }).click();
  const antipasti = page.locator(".pro-category").first();
  const rows = antipasti.locator("[data-row-id]");
  await expect(rows).toHaveCount(4);

  const grip = antipasti.locator('[data-row-id="burrata"] .pro-grip');
  const target = await antipasti.locator('[data-row-id="vitello"]').boundingBox();
  const start = await grip.boundingBox();
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    start!.x + start!.width / 2,
    target!.y + target!.height * 0.8,
    { steps: 12 },
  );
  await page.mouse.up();

  expect(
    await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-row-id")),
    ),
  ).toEqual(["caprese", "vitello", "burrata", "arancini"]);
  await expect(publishBar(page)).toContainText("1 modification");
});

test("les feuilles gardent le focus et le rendent à la fermeture", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/nonna-lydie");
  const opener = page.getByRole("button", { name: "Infos pratiques" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Nonna Lydie" });
  await expect(dialog.getByRole("button", { name: "Fermer" })).toBeFocused();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) => element.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("un plat épuisé après l’ajout sort du total et de la vue serveur", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/nonna-lydie?t=4");
  const category = page.locator(".pm-category");
  await category
    .getByRole("button", { name: "Ajouter Burrata Pugliese à ma sélection" })
    .click();
  await category
    .getByRole("button", { name: "Ajouter Tiramisù della Casa à ma sélection" })
    .click();
  await expect(
    page.getByRole("button", { name: /Ouvrir ma sélection : 2 articles, 23/ }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await page
    .getByRole("switch", { name: "Disponibilité de Burrata Pugliese" })
    .click();

  await page.goto("/menu/nonna-lydie");
  const pill = page.getByRole("button", { name: /Ouvrir ma sélection : 1 article, 9/ });
  await pill.click();
  const selection = page.getByRole("dialog", { name: "Ma sélection" });
  await expect(selection).toContainText("Épuisé entre-temps · non compté");
  await expect(selection).toContainText(/Total estimé9\s€/);
  await selection.getByRole("button", { name: "Montrer au serveur" }).click();
  const waiter = page.getByRole("dialog", { name: "Sélection pour le serveur" });
  await expect(waiter).toContainText("Table 4");
  await expect(waiter).toContainText("1×Tiramisù della Casa");
  await expect(waiter).not.toContainText("Burrata");
  await expect(waiter).toContainText("1 plat épuisé retiré de la liste.");
});
