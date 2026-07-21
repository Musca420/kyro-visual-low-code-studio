import { expect, test } from "@playwright/test";
import { basename } from "node:path";

test("task runner locale confinato, auditabile e limitato al progetto aperto", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Terminal test ${Date.now()}`);
  await page
    .getByRole("button", { name: "Blank project Start with a clean canvas" })
    .click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(
    page.getByRole("heading", { name: "Project tasks" }),
  ).toBeVisible();
  await expect(page.locator(".terminal-status")).toContainText("running");
  await expect(page.locator(".terminal-path code")).toContainText(
    basename(process.cwd()),
  );

  await page
    .getByLabel("Command", { exact: true })
    .fill("git status --short");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByLabel("Terminal output")).toContainText(
    "> git status --short",
  );

  await page.getByLabel("Command", { exact: true }).fill('node -e "console.log(process.cwd())"');
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("alert")).toContainText("not allowed");
  await page.getByLabel("Command", { exact: true }).fill("git status; powershell whoami");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("alert")).toContainText("shell operators");
  await page.screenshot({
    path: "artifacts/terminal-running.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.locator(".terminal-status")).toContainText("closed");
  await expect(page.getByLabel("Command", { exact: true })).toBeDisabled();

  const unauthorized = await page.evaluate(async () => {
    const response = await fetch("/api/terminal/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: "not-open" }),
    });
    return response.status;
  });
  expect(unauthorized).toBe(403);
});
