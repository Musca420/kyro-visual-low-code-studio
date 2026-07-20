import { expect, test } from "@playwright/test";

test("Test A: sito professionale multipagina con dati e flow creati dalla UI", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");

  await page.getByLabel("Project name").fill("Professional Website Test A");
  await page
    .getByRole("button", { name: "Landing page Hero, features, CTA, and footer" })
    .click();
  await expect(page.getByRole("button", { name: /Pricing/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Contact/ })).toBeVisible();
  await page.getByRole("button", { name: /Hero title/ }).click();
  const inspector = page.locator(".right-panel");
  await inspector.getByLabel("Background color value").fill("#fff3c4");
  await inspector.getByLabel("Quick animation").selectOption({ label: "Rise" });

  await page.getByRole("button", { name: "Data" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Contact requests");
  await page.getByLabel("Collection", { exact: true }).fill("contacts");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await expect(
    page.getByText("IndexedDB source created and schema validated"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Create landing interactions" }).click();
  await expect(page.getByLabel("Active flow").locator("option")).toHaveCount(3);
  await page
    .getByLabel("Active flow")
    .selectOption({ label: "Send contact request" });
  const flowNodes = page.getByRole("navigation", { name: "Flow steps" });
  await expect(flowNodes.getByRole("button", { name: "Save request", exact: true })).toBeVisible();
  await expect(flowNodes.getByRole("button", { name: "Validate request", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  const site = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(
    site.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toBeVisible();
  await expect(
    site.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toHaveCSS("background-color", "rgb(255, 243, 196)");
  await site
    .getByRole("button", { name: /Learn more/ })
    .first()
    .click();
  await expect(site.getByRole("dialog")).toBeVisible();
  await site.getByRole("button", { name: "Close dialog" }).click();

  await site.getByRole("link", { name: "Pricing" }).click();
  await expect(
    site.getByRole("heading", {
      name: "A simple plan for every ambition.",
    }),
  ).toBeVisible();
  await site.getByLabel("Search plans").fill("Team");
  await expect(site.locator("[data-plan]:visible")).toHaveCount(1);
  await expect(site.getByRole("heading", { name: "Team" })).toBeVisible();
  await site.getByLabel("Search plans").fill("does-not-exist");
  await expect(
    site.getByText("No plan matches your search."),
  ).toBeVisible();

  await site.getByRole("link", { name: "About" }).click();
  await expect(
    site.getByRole("heading", { name: "Let’s build something memorable." }),
  ).toBeVisible();
  await site.getByRole("button", { name: "Send request" }).click();
  await expect(site.getByRole("alert")).toContainText("Complete name");
  await site.getByLabel("Name").fill("Giulia Rossi");
  await site.getByLabel("Email").fill("giulia@example.it");
  await site
    .getByLabel("Message")
    .fill("Vorrei costruire un portale clienti personalizzato.");
  await site.getByRole("button", { name: "Send request" }).click();
  await expect(site.getByRole("status")).toContainText(
    "Request saved successfully",
  );
  await expect(
    site.getByText(/Giulia Rossi <giulia@example.it>/),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/professional-website-contact-desktop.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "mobile" }).click();
  await expect(
    site.getByRole("heading", { name: "Build clearer products, faster." }),
  ).toBeVisible();
  await page.waitForTimeout(150);
  await site.getByRole("button", { name: "Open menu" }).click();
  await expect(site.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(site.getByRole("link", { name: "Pricing" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/professional-website-mobile.png",
    fullPage: true,
  });

  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page
    .getByRole("button", { name: "Close project and return to the dashboard" })
    .click();
  await page
    .getByRole("button", { name: /Professional Website Test A/ })
    .click();
  await page.getByRole("button", { name: "Preview" }).click();
  const reopened = page.frameLocator('iframe[title="Preview isolata"]');
  await reopened.getByRole("link", { name: "About" }).click();
  await expect(
    reopened.getByText(/Giulia Rossi <giulia@example.it>/),
  ).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  await (await download).saveAs("artifacts/professional-website-test-a.zip");
  expect(errors).toEqual([]);
});
