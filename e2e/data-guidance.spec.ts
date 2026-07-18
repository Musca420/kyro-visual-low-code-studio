import { expect, test } from "@playwright/test";

test("propone storage locale, API esistente o backend generato in linguaggio semplice", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`Backend guidato ${Date.now()}`);
  await page.locator(".template").filter({ hasText: "Lista attività" }).click();
  await page.getByRole("button", { name: "Dati" }).click();

  await expect(page.getByText("Su questo dispositivo")).toBeVisible();
  await expect(page.getByText("Servizio già esistente")).toBeVisible();
  await page.getByLabel("Genera anche il backend").check();
  await expect(
    page.getByRole("textbox", { name: /Indirizzo API/ }),
  ).toHaveValue("http://127.0.0.1:8787/records");
  await page.getByLabel("Nome", { exact: true }).fill("Backend attività");
  await page.getByLabel("Collezione", { exact: true }).fill("records");
  await page
    .getByRole("button", { name: "Configura backend generato" })
    .click();
  await expect(
    page.getByText("Backend locale configurato: verrà incluso nell’export"),
  ).toBeVisible();
  await expect(page.locator(".source-card")).toContainText(
    "generated / records",
  );
});

test("crea uno schema dati personalizzato interamente dall'interfaccia", async ({ page }) => {
  const name = `Schema visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(name);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "+ Aggiungi campo" }).click();
  const fields = page.getByLabel("Nome campo");
  await fields.last().fill("budget");
  await page.getByLabel("Tipo campo budget").selectOption("number");
  await page.getByRole("button", { name: "+ Aggiungi campo" }).click();
  await fields.last().fill("pubblicato");
  await page.getByLabel("Tipo campo pubblicato").selectOption("boolean");
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  const source = page.locator(".source-card");
  await expect(source).toContainText("budget:number");
  await expect(source).toContainText("pubblicato:boolean");
  await page.screenshot({ path: "artifacts/frontend-editor-visual-schema.png", fullPage: true });
  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await expect(page.locator(".source-card")).toContainText("budget:number");
  await expect(page.locator(".source-card")).toContainText("pubblicato:boolean");
});
