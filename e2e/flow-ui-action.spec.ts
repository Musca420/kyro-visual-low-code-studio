import { expect, test } from "@playwright/test";

test("un flow cambia davvero un elemento della preview senza codice", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`UI visuale ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();

  const nodePalette = page.getByRole("complementary", { name: "Add nodes to the flow" });
  await nodePalette.getByLabel("Search actions").fill("Change element");
  await nodePalette.getByRole("button", { name: "Change element", exact: true }).click();
  await page.getByLabel("Step name").fill("Visual confirmation");
  await page.getByLabel("Element to change").selectOption({ label: "Button · button" });
  await page.getByLabel("Element change").selectOption("text");
  await page.getByLabel("Change value").fill("Item added");
  const refresh = page.locator(".react-flow__node").filter({ hasText: "Refresh list" });
  const visual = page.locator(".react-flow__node").filter({ hasText: "Visual confirmation" });
  await page.getByRole("button", { name: "Fit view" }).click();
  const edgeCount = await page.locator(".react-flow__edge").count();
  const sourceBox = (await refresh.locator(".react-flow__handle.source").boundingBox())!;
  const targetBox = (await visual.locator(".react-flow__handle.target").boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(edgeCount + 1);

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  const readRuntimeState = () => page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("frontend-editor");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T,>(store: string, index?: string) => new Promise<T>((resolve, reject) => {
      const objectStore = database.transaction(store).objectStore(store);
      const request = index ? objectStore.index(index).getAll(id!) : objectStore.get(id!);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
    const [project, runs] = await Promise.all([
      read<{ revision: number }>("projects"),
      read<Array<{ projectId: string; graphRevision: number }>>("runtimeRuns", "projectId"),
    ]);
    database.close();
    return { revision: project.revision, runs };
  }, projectId);
  const beforeRun = await readRuntimeState();
  await preview.getByLabel("New task").fill("Azione grafica");
  await preview.getByRole("button", { name: "Add" }).click();
  await expect(preview.getByRole("button", { name: "Item added" })).toBeVisible();
  await expect(page.locator(".log-console")).toContainText("Visual confirmation: completed");
  await expect.poll(async () => (await readRuntimeState()).runs.length).toBeGreaterThan(beforeRun.runs.length);
  const afterRun = await readRuntimeState();
  expect(afterRun.revision).toBe(beforeRun.revision);
  expect(afterRun.runs.at(-1)?.graphRevision).toBe(beforeRun.revision);
  await page.reload();
  await page.getByRole("button", { name: /UI visuale/ }).click();
  expect((await readRuntimeState()).runs.length).toBe(afterRun.runs.length);
  await page.screenshot({ path: "artifacts/frontend-editor-flow-ui-action.png", fullPage: true });
});
