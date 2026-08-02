import { expect, test, type Page } from "@playwright/test";

const tinySvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#d97757"/></svg>',
);

async function blockExternalPlayers(page: Page) {
  await page.route(/(youtube|youtu\.be|vimeo)/, (route) => route.abort());
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
  await page.getByRole("button", { name: "Continuer avec Google" }).click();
  await expect(page.locator(".form-error")).toContainText("identifiants OAuth");
  await page.goto("/sign-up");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("onboarding puis création complète d’un menu publié", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Nom de l’établissement").fill("Bistro des Tests");
  await expect(page.getByLabel("Adresse du menu")).toHaveValue(
    "bistro-des-tests",
  );
  await page.getByLabel("Type").selectOption("Café");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByRole("button", { name: "Créer mon menu" }).click();
  await expect(page).toHaveURL(/\/dashboard\/menu$/);
  await expect(page.getByText("Votre menu est vide")).toBeVisible();

  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Brunch");
  await page.getByLabel("Sous-titre").fill("Toute la journée");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Brunch" })).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un plat" }).click();
  await page.getByLabel("Nom du plat").fill("Œufs bénédicte");
  await page
    .getByLabel("Description")
    .fill("Œufs pochés, brioche et sauce hollandaise.");
  await page.getByLabel("Prix (€)").fill("16,50");
  await page
    .getByLabel("Vidéo YouTube ou Vimeo")
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("heading", { name: "Œufs bénédicte", level: 3 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Modifier Œufs bénédicte" }).click();
  const imageInput = page.getByRole("dialog").locator('input[type="file"]');
  await imageInput.setInputFiles({
    name: "oeufs.svg",
    mimeType: "image/svg+xml",
    buffer: tinySvg,
  });
  await expect(
    page.getByRole("dialog").getByRole("img", { name: "oeufs.svg" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("button", { name: "Publié" })).toBeVisible();
  await page.goto("/dashboard/share");
  await expect(page.getByTestId("qr-code").locator("svg")).toBeVisible();
  await expect(page.getByText(/bistro-des-tests/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger en SVG" }).click();
  await expect((await download).suggestedFilename()).toBe(
    "qr-bistro-des-tests.svg",
  );

  await page.goto("/bistro-des-tests");
  await expect(
    page.getByRole("heading", { name: "Bistro des Tests", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Œufs pochés, brioche et sauce hollandaise."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voir Œufs bénédicte" }).click();
  await expect(
    page.getByRole("dialog").getByRole("img", { name: "oeufs.svg" }),
  ).toBeVisible();
});

test("édition, ordre, disponibilité et suppression dans le menu", async ({
  page,
}) => {
  await page.goto("/dashboard/menu");
  const sections = page.locator(".builder-section");
  await expect(
    sections.first().getByRole("heading", { name: "Antipasti" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Descendre Antipasti" }).click();
  await expect(
    sections.nth(1).getByRole("heading", { name: "Antipasti" }),
  ).toBeVisible();

  await page.getByLabel("Disponibilité de Burrata Pugliese").uncheck();
  await page.getByRole("button", { name: "Modifier Burrata Pugliese" }).click();
  await page.getByLabel("Prix (€)").fill("15");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("15 €")).toBeVisible();

  await page.getByRole("button", { name: "Catégorie", exact: true }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Temporaire");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer Temporaire" }).click();
  await expect(page.getByRole("heading", { name: "Temporaire" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Publier" }).click();
  await page.goto("/nonna-lydie");
  await expect(page.getByText("Burrata Pugliese")).toHaveCount(0);
});

test("apparence, logo, couverture et consentement vidéo Vimeo", async ({
  page,
}) => {
  await page.goto("/dashboard/appearance");
  await page.getByLabel("Code couleur").fill("#125c4a");
  await page
    .getByTestId("logo-input")
    .setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: tinySvg,
    });
  await page
    .getByTestId("cover-input")
    .setInputFiles({
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
  await expect(page.getByRole("status")).toContainText("Vidéo enregistrée");
  await page.getByRole("button", { name: "Publier" }).click();

  await page.goto("/nonna-lydie");
  await expect(
    page.getByRole("img", { name: "Logo Nonna Lydie" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lire la vidéo de couverture" })
    .click();
  await expect(
    page.getByRole("button", { name: /Lire sur Vimeo/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Lire sur Vimeo/ }).click();
  await expect(page.getByTestId("video-frame")).toHaveAttribute(
    "src",
    /player\.vimeo\.com\/video\/76979871/,
  );
});

test("les réglages restent en brouillon jusqu’à la publication", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  await page.getByLabel("Nom", { exact: true }).fill("Nonna Lydie Nouveau");
  await page
    .getByLabel("Phrase d’accroche")
    .fill("Une nouvelle promesse encore en brouillon.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Modifications enregistrées",
  );

  await page.goto("/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Nonna Lydie", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Une nouvelle promesse encore en brouillon."),
  ).toHaveCount(0);

  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Publier" }).click();
  await page.goto("/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Nonna Lydie Nouveau" }),
  ).toBeVisible();
});

test("menu public mobile, galerie vidéo et page inconnue", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Nonna Lydie" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Voir Tagliatelle al Tartufo" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Lire sur YouTube/ }).click();
  await expect(page.getByTestId("video-frame")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed/,
  );
  await page.getByRole("button", { name: "Fermer" }).click();

  await page.goto("/ce-menu-nexiste-pas");
  await expect(
    page.getByRole("heading", { name: "Cette table est encore vide." }),
  ).toBeVisible();
});

test("vue d’ensemble et navigation responsive du tableau de bord", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Catégories", { exact: true })).toBeVisible();
  await expect(page.getByText("7", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Navigation du tableau de bord" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: /Apparence/ })
    .last()
    .click();
  await expect(page).toHaveURL(/\/dashboard\/appearance$/);
});
