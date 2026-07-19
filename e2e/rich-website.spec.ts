import { expect, test } from "@playwright/test";

test("Test A: sito professionale multipagina con dati e flow creati dalla UI", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  await page.getByLabel("Nome progetto").fill("Professional Website Test A");
  await page
    .getByRole("button", { name: "Landing page Hero, feature, CTA e footer" })
    .click();
  await expect(page.getByRole("button", { name: /Prezzi/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Contatti/ })).toBeVisible();
  await page.getByRole("button", { name: /Hero title/ }).click();
  const inspector = page.locator(".right-panel");
  await inspector.getByLabel("Colore sfondo valore").fill("#fff3c4");
  await inspector.getByLabel("Animazione rapida").selectOption({ label: "Salita" });

  await page.getByRole("button", { name: "Dati" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Contact requests");
  await page.getByLabel("Collezione", { exact: true }).fill("contacts");
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await expect(
    page.getByText("Sorgente IndexedDB creata e schema validato"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Crea interazioni landing" }).click();
  await expect(page.getByLabel("Flow attivo").locator("option")).toHaveCount(3);
  await page
    .getByLabel("Flow attivo")
    .selectOption({ label: "Invia richiesta contatto" });
  const flowNodes = page.getByRole("navigation", { name: "Nodi del flow" });
  await expect(flowNodes.getByRole("button", { name: "Salva richiesta", exact: true })).toBeVisible();
  await expect(flowNodes.getByRole("button", { name: "Valida richiesta", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  const site = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(
    site.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toBeVisible();
  await expect(
    site.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toHaveCSS("background-color", "rgb(255, 243, 196)");
  await site
    .getByRole("button", { name: /Learn more/ })
    .first()
    .click();
  await expect(site.getByRole("dialog")).toBeVisible();
  await site.getByRole("button", { name: "Chiudi modal" }).click();

  await site.getByRole("link", { name: "Pricing" }).click();
  await expect(
    site.getByRole("heading", {
      name: "Un piano semplice per ogni ambizione.",
    }),
  ).toBeVisible();
  await site.getByLabel("Cerca tra i piani").fill("Team");
  await expect(site.locator("[data-plan]:visible")).toHaveCount(1);
  await expect(site.getByRole("heading", { name: "Team" })).toBeVisible();
  await site.getByLabel("Cerca tra i piani").fill("inesistente");
  await expect(
    site.getByText("Nessun piano corrisponde alla ricerca."),
  ).toBeVisible();

  await site.getByRole("link", { name: "About" }).click();
  await expect(
    site.getByRole("heading", { name: "Costruiamo qualcosa di memorabile." }),
  ).toBeVisible();
  await site.getByRole("button", { name: "Invia richiesta" }).click();
  await expect(site.getByRole("alert")).toContainText("Completa nome");
  await site.getByLabel("Nome").fill("Giulia Rossi");
  await site.getByLabel("Email").fill("giulia@example.it");
  await site
    .getByLabel("Messaggio")
    .fill("Vorrei costruire un portale clienti personalizzato.");
  await site.getByRole("button", { name: "Invia richiesta" }).click();
  await expect(site.getByRole("status")).toContainText(
    "Richiesta salvata con successo",
  );
  await expect(
    site.getByText(/Giulia Rossi <giulia@example.it>/),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/professional-website-contact-desktop.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "mobile" }).click();
  await expect(
    site.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toBeVisible();
  await page.waitForTimeout(150);
  await site.getByRole("button", { name: "Apri menu" }).click();
  await expect(site.getByRole("button", { name: "Apri menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(site.getByRole("link", { name: "Pricing" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/professional-website-mobile.png",
    fullPage: true,
  });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page
    .getByRole("button", { name: "Chiudi progetto e torna alla dashboard" })
    .click();
  await page
    .getByRole("button", { name: /Professional Website Test A/ })
    .click();
  await page.getByRole("button", { name: "Preview" }).click();
  const reopened = page.frameLocator('iframe[title="Preview isolata"]');
  await reopened.getByRole("link", { name: "About" }).click();
  await expect(
    reopened.getByText(/Giulia Rossi <giulia@example.it>/),
  ).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta app" }).click();
  await (await download).saveAs("artifacts/professional-website-test-a.zip");
  expect(errors).toEqual([]);
});
