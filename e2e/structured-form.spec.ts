import { expect, test } from "@playwright/test";

test("un form visuale salva un record multi-campo reale", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const projectName = `Form strutturato ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(projectName);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  await palette.locator("button").filter({ hasText: "form" }).click();

  const addField = async (label: string, fieldName: string, type: "text" | "number") => {
    await palette.locator("button").filter({ hasText: "input" }).click();
    await page.getByLabel("Testo o etichetta").fill(label);
    await page.getByLabel("Nome del campo dati").fill(fieldName);
    await page.getByLabel("Tipo di campo").selectOption(type);
    await page.getByLabel("Dentro").selectOption({ label: "Form" });
  };
  await addField("Nome prodotto", "name", "text");
  await addField("Prezzo", "price", "number");
  await palette.locator("button").filter({ hasText: "button" }).click();
  await page.getByLabel("Testo o etichetta").fill("Salva prodotto");
  await page.getByLabel("Comportamento pulsante").selectOption("submit");
  await page.getByLabel("Dentro").selectOption({ label: "Form" });
  await palette.locator("button").filter({ hasText: "list" }).click();

  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Prodotti locali");
  await page.getByLabel("Collezione", { exact: true }).fill("products");
  await page.getByLabel("Nome campo").nth(1).fill("name");
  await page.getByRole("button", { name: "+ Aggiungi campo" }).click();
  await page.getByLabel("Nome campo").last().fill("price");
  await page.getByLabel("Tipo campo price").selectOption("number");
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();

  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  await page.locator(".react-flow__node").filter({ hasText: "Click pulsante" }).click();
  await page.getByLabel("Tipo evento").selectOption("submit");
  await page.getByLabel("Elemento collegato").selectOption({ label: "Form · form" });
  await page.locator(".react-flow__node").filter({ hasText: "Leggi input" }).click();
  await page.getByRole("button", { name: "Elimina nodo" }).click();
  await page.locator(".react-flow__node").filter({ hasText: "Non vuoto" }).click();
  await page.getByLabel("Campo validazione").fill("name");
  await page.getByLabel("Regola validazione").selectOption("required");
  await page.getByLabel("Messaggio validazione").fill("Inserisci il nome del prodotto");
  const eventNode = page.locator(".react-flow__node").filter({ hasText: "Click pulsante" });
  await eventNode.click();
  await page.getByLabel("Passo successivo").selectOption({ label: "Non vuoto" });

  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page.getByRole("tree").getByRole("button", { name: /Form/ }).first().click();
  await expect(page.locator(".program-connections")).toContainText("1 eventi");

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  expect(await preview.locator("script").evaluate((script) => script.textContent)).toContain('"event":"submit"');
  await preview.getByLabel("Prezzo").fill("39");
  await expect(preview.getByRole("button", { name: "Salva prodotto" })).toHaveAttribute("type", "submit");
  await preview.getByRole("button", { name: "Salva prodotto" }).click();
  await expect(preview.getByRole("alert")).toContainText("Inserisci il nome del prodotto");
  await preview.getByLabel("Nome prodotto").fill("Lampada Aurora");
  await preview.getByRole("button", { name: "Salva prodotto" }).click();
  expect(runtimeErrors).toEqual([]);
  await expect(page.locator(".log-console")).toContainText("Inserisci record: completato");
  await expect(preview.getByText("Lampada Aurora")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-structured-form.png", fullPage: true });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByText("Lampada Aurora")).toBeVisible();
});
