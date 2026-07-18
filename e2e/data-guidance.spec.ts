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
