import { expect, test, type Page } from "@playwright/test";

const publication = (page: Page) =>
  page.getByRole("region", { name: "Publication" });
async function publish(page: Page) {
  await publication(page)
    .getByRole("button", { name: "Publier", exact: true })
    .click();
  await expect(publication(page)).toHaveCount(0);
}

test("les modifications non enregistrées restent après un départ annulé", async ({
  page,
}) => {
  await page.goto("/dashboard/settings");
  await page.getByLabel("Nom", { exact: true }).fill("Nom à conserver");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Carte" })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(
    "Nom à conserver",
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Modifications enregistrées" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Carte" })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/menu$/);
});

test("import, aperçu privé, publication et restauration dans le brouillon", async ({
  page,
}) => {
  await page.goto("/dashboard/tools");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en CSV" }).click();
  expect((await download).suggestedFilename()).toBe("nonna-lydie.csv");
  await page
    .getByLabel("Choisir un fichier CSV")
    .setInputFiles({
      name: "carte.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "categorie;nom;prix;description\nSpécialités;Velouté du marché;12,50;Courge et noisettes\nSpécialités;Riz aux légumes;16;Légumes de saison",
      ),
    });
  await expect(page.getByRole("table")).toContainText("Velouté du marché");
  await page.getByRole("button", { name: "Ajouter au brouillon" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.goto("/preview");
  await expect(page.getByText("Aperçu du brouillon")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Velouté du marché" }),
  ).toBeVisible();
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Velouté du marché" }),
  ).toHaveCount(0);
  await page.goto("/dashboard/menu");
  await publish(page);
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Velouté du marché" }),
  ).toBeVisible();
  await page.goto("/dashboard/history");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".pro-history-row")
    .filter({ hasText: "Version 1" })
    .getByRole("button", { name: "Restaurer" })
    .click();
  await expect(publication(page)).toBeVisible();
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "Velouté du marché" }),
  ).toHaveCount(0);
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Velouté du marché" }),
  ).toBeVisible();
  await page.goto("/dashboard/history");
  await publish(page);
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Velouté du marché" }),
  ).toHaveCount(0);
});

test("dupliquer puis déplacer un plat vers une autre catégorie", async ({
  page,
}) => {
  await page.goto("/dashboard/menu");
  await page
    .getByRole("button", { name: "Modifier Burrata Pugliese", exact: true })
    .click();
  await page.getByRole("button", { name: "Dupliquer ce plat" }).click();
  await page
    .getByRole("button", {
      name: "Modifier Burrata Pugliese (copie)",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Catégorie", { exact: true })
    .selectOption({ label: "Dolci" });
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .locator(".pro-category")
      .filter({
        has: page.getByRole("heading", { name: "Dolci", exact: true }),
      }),
  ).toContainText("Burrata Pugliese (copie)");
});

test("archiver, réactiver et supprimer le dernier établissement sans ressusciter la démo", async ({
  page,
}) => {
  await page.goto("/dashboard/venue");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archiver l’établissement" }).click();
  await expect(
    page.getByRole("button", { name: "Réactiver l’établissement" }),
  ).toBeVisible();
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Cette table est encore vide." }),
  ).toBeVisible();
  await page.goto("/dashboard/venue");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Réactiver l’établissement" }).click();
  await publish(page);
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Nonna Lydie", exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard/venue");
  await page
    .getByText("Supprimer définitivement cet établissement", { exact: true })
    .click();
  await page
    .getByLabel("Recopiez « Nonna Lydie » pour confirmer")
    .fill("Nonna Lydie");
  await page
    .getByRole("button", { name: "Supprimer définitivement", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.reload();
  await page.goto("/menu/nonna-lydie");
  await expect(
    page.getByRole("heading", { name: "Cette table est encore vide." }),
  ).toBeVisible();
  await page.goto("/onboarding");
  await page.getByLabel("Nom de l’établissement").fill("Après suppression");
  await page.getByRole("button", { name: "Créer mon menu" }).click();
  await expect(page).toHaveURL(/\/dashboard\/menu$/);
  await page.getByRole("button", { name: /Établissement actif/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Mes établissements" })
      .getByRole("listitem"),
  ).toHaveCount(1);
});

test("les préférences de confidentialité restent facultatives et persistantes", async ({
  page,
}) => {
  await page.goto("/privacy");
  const statistics = page.getByRole("checkbox", {
    name: /Autoriser les statistiques/,
  });
  const videos = page.getByRole("checkbox", { name: /Autoriser les lecteurs/ });
  await expect(statistics).not.toBeChecked();
  await expect(videos).not.toBeChecked();
  await videos.check();
  await page.reload();
  await expect(videos).toBeChecked();
  await videos.uncheck();
  await page.reload();
  await expect(videos).not.toBeChecked();
  await expect(statistics).not.toBeChecked();
});

test("une grande photo est réduite avant d’être enregistrée", async ({
  page,
}) => {
  await page.goto("/dashboard/menu");
  // An actual, decodable PNG over 2 MB exercises the browser's image pipeline.
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 1200;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 12345;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  const file = Buffer.from(base64, "base64");
  expect(file.length).toBeGreaterThan(2 * 1024 * 1024);
  await page
    .getByRole("button", { name: "Modifier Burrata Pugliese", exact: true })
    .click();
  await page
    .getByTestId("item-images-input")
    .setInputFiles({
      name: "grande-photo.png",
      mimeType: "image/png",
      buffer: file,
    });
  const photo = page.getByRole("dialog").locator('img[src^="data:image/webp"]');
  await expect(photo).toHaveCount(1);
  const size = await photo.evaluate((element: HTMLImageElement) => ({
    width: element.naturalWidth,
    bytes: element.src.split(",")[1]!.length * 0.75,
  }));
  expect(size.width).toBe(1600);
  expect(size.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Modifier Burrata Pugliese", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator('img[src^="data:image/webp"]'),
  ).toHaveCount(1);
});
