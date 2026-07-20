import { expect, test } from "@playwright/test";

test("l'intento visuale espone dipendenze e capacità mancanti", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Program Graph ${Date.now()}`);
  await page
    .getByRole("button", { name: "Blank project Start with a clean canvas" })
    .click();
  await page.getByRole("button", { name: "Add page" }).first().click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: "list" }).click();
  await page.getByTestId("component-list").click();

  const graph = page.locator(".program-connections");
  await expect(graph).toContainText("Data not connected");
  await expect(graph).toContainText("0 data sources");
  await page.getByText("Meaning in the program").click();
  await page.getByLabel("Role", { exact: true }).fill("primary result");
  await page.getByLabel("Action", { exact: true }).fill("show athletes");
  await page.getByLabel("Entity", { exact: true }).fill("Athlete");
  await page.getByLabel("Expected result", { exact: true }).fill("updated list");
  await page.getByLabel("loading").check();
  await expect(graph).toContainText("Loading state is not represented");

  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  await expect
    .poll(async () => {
      const response = await request.get(`/api/live/status?projectId=${projectId}`);
      return (await response.json()).capabilities?.map((item: { id: string }) => item.id);
    })
    .toEqual(expect.arrayContaining(["data-binding", "state-loading"]));

  await graph.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/program-graph-capability-resolver.png", fullPage: true });
  await graph.getByRole("button", { name: "Configure storage" }).click();
  await expect(page.getByRole("heading", { name: "Data & integrations" })).toBeVisible();
  await page.screenshot({ path: "artifacts/program-graph-data-guidance.png", fullPage: true });
});

test("dal nodo del flow risale a dati e componenti", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Reverse Graph ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page" }).first().click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: "Flow", exact: true }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();
  await page.getByRole("navigation", { name: "Flow steps" }).getByRole("button", { name: "Create record", exact: true }).click();

  const dependencies = page.getByRole("region", { name: "Node dependencies" });
  await expect(dependencies).toContainText("Create record");
  await expect(dependencies).toContainText("Local tasks");
  await expect(dependencies).toContainText("List");
  await dependencies.getByText("Generated code impact").click();
  await dependencies.getByRole("button", { name: "src/main.ts" }).click();
  const generated = page.getByRole("dialog", { name: "src/main.ts" });
  await expect(generated).toContainText("indexedDB.open");
  await page.screenshot({ path: "artifacts/frontend-editor-generated-file.png", fullPage: true });
  await page.getByRole("button", { name: "Close generated file" }).click();
  await dependencies.getByRole("button", { name: /Open List/ }).click();
  await expect(page.locator(".right-panel")).toContainText("Connected program");
  await expect(page.getByTestId("component-list")).toHaveClass(/selected/);

  await page.getByRole("button", { name: "Data", exact: true }).click();
  const sourceImpact = page.getByRole("region", { name: "Data source impact" });
  await expect(sourceImpact).toContainText("1 elements");
  await expect(sourceImpact).toContainText("1 flow");
  await expect(sourceImpact).toContainText("loads lists");
  await expect(sourceImpact).toContainText("src/main.ts");
  await page.screenshot({ path: "artifacts/data-source-unified-graph.png", fullPage: true });
  await sourceImpact.getByRole("button", { name: /Open flow Add task/ }).click();
  await expect(page.getByRole("heading", { name: "Flow editor" })).toBeVisible();
});
