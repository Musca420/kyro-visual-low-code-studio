import { expect, test } from "@playwright/test";

test("manual changes and undo share the persistent authorized Transaction Engine", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Transaction Engine ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "Title" }).click();
  await page.getByLabel("Text or label").fill("Verified transaction");
  await expect(page.getByTestId("component-title").getByRole("heading")).toHaveText("Verified transaction");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("component-title").getByRole("heading")).toHaveText("Title");

  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  const transactions = await page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("frontend-editor");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = database.transaction("projectTransactions", "readonly").objectStore("projectTransactions").index("projectId").getAll(id!);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => database.close());
  }, projectId);
  expect(transactions.length).toBeGreaterThanOrEqual(4);
  expect(transactions.every((item) => item.actor === "manual" && (item.authorization as { kind: string }).kind === "user")).toBe(true);
  expect(transactions.every((item) => {
    const verification = item.verification as { status?: string; stages?: { required: boolean; status: string; evidence: { hash?: string }[] }[] } | undefined;
    return verification?.status === "verified"
      && verification.stages?.every((stage) => !stage.required || (stage.status === "passed" && stage.evidence[0]?.hash?.length === 64));
  })).toBe(true);
  const rollback = transactions.find((item) => item.status === "rolled_back") as { rollbackOf?: string; audit: { action: string }[]; verification?: { effects: string[] } } | undefined;
  expect(rollback?.rollbackOf).toBeTruthy();
  expect(rollback?.audit.map((event) => event.action)).toEqual(["authorized", "verified", "rolled_back"]);
  expect(rollback?.verification?.effects).toEqual(expect.arrayContaining(["graph", "runtime", "behavior", "visual", "build"]));

  await page.reload();
  await page.getByRole("button", { name: /Transaction Engine/ }).click();
  await expect(page.getByTestId("component-title").getByRole("heading")).toHaveText("Title");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator("iframe[title='Preview isolata']").contentFrame().getByRole("heading", { name: "Title" })).toBeVisible();
  await page.screenshot({ path: "artifacts/transaction-engine-rollback.png", fullPage: true });
});
