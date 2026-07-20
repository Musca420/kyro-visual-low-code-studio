import { expect, test } from "@playwright/test";

test("gli export landing e dashboard mantengono UI e comportamento", async ({
  browser,
}) => {
  test.skip(
    !process.env.SCENARIO_EXPORTS,
    "Richiede gli ZIP degli scenari estratti e avviati",
  );
  const context = await browser.newContext();
  const landing = await context.newPage();
  await landing.goto("http://127.0.0.1:4181");
  await expect(
    landing.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toBeVisible();
  await landing.getByRole("button", { name: "Explore features" }).click();
  await expect(
    landing.getByRole("heading", {
      name: "Everything your team needs to move.",
    }),
  ).toBeVisible();
  await landing.getByRole("button", { name: "See how it works" }).click();
  await expect(landing.getByRole("status")).toContainText(
    "Interactive demo enabled",
  );
  await landing.screenshot({
    path: "artifacts/simple-landing-export.png",
    fullPage: true,
  });

  const dashboard = await context.newPage();
  await dashboard.goto("http://127.0.0.1:4182");
  await expect(
    dashboard.getByRole("heading", { name: "Good morning, Alex" }),
  ).toBeVisible();
  await dashboard.getByRole("button", { name: /New project/ }).click();
  const form = dashboard.locator("#project-modal form");
  await form.getByLabel("Project name").fill("Export verification");
  await form
    .getByLabel("Description")
    .fill("Created in the independently running export");
  await form.getByLabel("Status").selectOption("In progress");
  await form.getByLabel("Priority").selectOption("High");
  await form.getByLabel("Due date").fill("2026-12-01");
  await form.getByRole("button", { name: "Save project" }).click();
  await expect(
    dashboard.getByText("Export verification", { exact: true }),
  ).toBeVisible();
  await expect(dashboard.locator('[data-kpi="total"]')).toHaveText("1");
  await dashboard.getByLabel("Search").fill("verification");
  await expect(dashboard.locator("tbody tr")).toHaveCount(1);
  await dashboard.screenshot({
    path: "artifacts/project-dashboard-export.png",
    fullPage: true,
  });

  const professional = await context.newPage();
  await professional.goto("http://127.0.0.1:4183");
  await expect(
    professional.getByRole("heading", {
      name: "Build clearer products, faster.",
    }),
  ).toHaveCSS("background-color", "rgb(255, 243, 196)");
  await professional.getByRole("link", { name: "Pricing" }).click();
  await professional.getByLabel("Cerca tra i piani").fill("Team");
  await expect(professional.locator("[data-plan]:visible")).toHaveCount(1);
  await professional.getByRole("link", { name: "About" }).click();
  await professional.getByLabel("Name").fill("Export User");
  await professional.getByLabel("Email").fill("export@example.it");
  await professional
    .getByLabel("Messaggio")
    .fill("Richiesta creata nell’export autonomo.");
  await professional.getByRole("button", { name: "Invia richiesta" }).click();
  await expect(
    professional.getByText(/Export User <export@example.it>/),
  ).toBeVisible();
  await professional.reload();
  await professional.getByRole("link", { name: "About" }).click();
  await expect(
    professional.getByText(/Export User <export@example.it>/),
  ).toBeVisible();
  await professional.screenshot({
    path: "artifacts/professional-website-export.png",
    fullPage: true,
  });
  await context.close();
});
