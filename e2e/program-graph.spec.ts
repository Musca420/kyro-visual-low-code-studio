import { expect, test } from "@playwright/test";

test("l'intento visuale espone dipendenze e capacità mancanti", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`Program Graph ${Date.now()}`);
  await page
    .getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" })
    .click();
  await page.getByRole("button", { name: "Aggiungi pagina" }).first().click();
  await page.locator(".palette button").filter({ hasText: "list" }).click();
  await page.getByTestId("component-list").click();

  const graph = page.locator(".program-connections");
  await expect(graph).toContainText("Dati non collegati");
  await expect(graph).toContainText("0 dati");
  await page.getByText("Significato nel programma").click();
  await page.getByLabel("Ruolo", { exact: true }).fill("risultato principale");
  await page.getByLabel("Azione", { exact: true }).fill("mostra atleti");
  await page.getByLabel("Entità", { exact: true }).fill("Athlete");
  await page.getByLabel("Risultato atteso", { exact: true }).fill("lista aggiornata");
  await page.getByLabel("loading").check();
  await expect(graph).toContainText("Stato loading non rappresentato");

  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  await expect
    .poll(async () => {
      const response = await request.get(`/api/live/status?projectId=${projectId}`);
      return (await response.json()).capabilities?.map((item: { id: string }) => item.id);
    })
    .toEqual(expect.arrayContaining(["data-binding", "state-loading"]));

  await graph.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/program-graph-capability-resolver.png", fullPage: true });
  await graph.getByRole("button", { name: "Configura archivio" }).click();
  await expect(page.getByRole("heading", { name: "Dati & integrazioni" })).toBeVisible();
  await page.screenshot({ path: "artifacts/program-graph-data-guidance.png", fullPage: true });
});

test("dal nodo del flow risale a dati e componenti", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`Reverse Graph ${Date.now()}`);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina" }).first().click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: "Flow", exact: true }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  await page.locator(".react-flow__node").filter({ hasText: "Inserisci record" }).click();

  const dependencies = page.getByRole("region", { name: "Dipendenze del nodo" });
  await expect(dependencies).toContainText("Inserisci record");
  await expect(dependencies).toContainText("Attività locali");
  await expect(dependencies).toContainText("List");
  await dependencies.getByRole("button", { name: /Apri List/ }).click();
  await expect(page.locator(".right-panel")).toContainText("Programma collegato");
  await expect(page.getByTestId("component-list")).toHaveClass(/selected/);

  await page.getByRole("button", { name: "Dati", exact: true }).click();
  const sourceImpact = page.getByRole("region", { name: "Impatto sorgente dati" });
  await expect(sourceImpact).toContainText("1 elementi");
  await expect(sourceImpact).toContainText("1 flow");
  await expect(sourceImpact).toContainText("carica elenchi");
  await expect(sourceImpact).toContainText("src/main.ts");
  await page.screenshot({ path: "artifacts/data-source-unified-graph.png", fullPage: true });
  await sourceImpact.getByRole("button", { name: /Apri flow Aggiungi attività/ }).click();
  await expect(page.getByRole("heading", { name: "Flow editor" })).toBeVisible();
});
