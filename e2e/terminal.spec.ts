import { expect, test } from "@playwright/test";

test("terminale locale reale, esplicito e limitato al progetto aperto", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`Terminal test ${Date.now()}`);
  await page
    .getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" })
    .click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Terminale" }).click();
  await expect(
    page.getByRole("heading", { name: "Terminale del progetto" }),
  ).toBeVisible();
  await expect(page.locator(".terminal-status")).toContainText("running");
  await expect(page.locator(".terminal-path code")).toContainText(
    "node editor",
  );

  await page
    .getByLabel("Comando")
    .fill("node -e \"console.log('FE_TERMINAL_OK')\"");
  await page.getByRole("button", { name: "Esegui" }).click();
  await expect(page.getByLabel("Output terminale")).toContainText(
    "FE_TERMINAL_OK",
  );

  await page.getByLabel("Comando").fill("Set-Location src");
  await page.getByRole("button", { name: "Esegui" }).click();
  await page.getByLabel("Comando").fill('node -e "console.log(process.cwd())"');
  await page.getByRole("button", { name: "Esegui" }).click();
  await expect(page.getByLabel("Output terminale")).toContainText(
    "node editor\\src",
  );
  await page.screenshot({
    path: "artifacts/terminal-running.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Termina sessione" }).click();
  await expect(page.locator(".terminal-status")).toContainText("closed");
  await expect(page.getByLabel("Comando")).toBeDisabled();

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
