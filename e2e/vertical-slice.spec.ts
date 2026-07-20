import { expect, test } from "@playwright/test";
import JSZip from "jszip";

test("vertical slice: progetto, builder, flow, IndexedDB, persistenza ed export", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Project name").fill("Vertical Slice E2E");
  await page
    .getByRole("button", { name: "Blank project Start with a clean canvas" })
    .click();

  await page
    .getByRole("button", { name: "Add page", exact: true })
    .click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  const canvas = page.locator(".design-canvas");
  await palette.getByRole("button", { name: "⌨ input" }).dragTo(canvas);
  await palette.getByRole("button", { name: "● button" }).dragTo(canvas);
  await palette.getByRole("button", { name: "≡ list" }).dragTo(canvas);
  await expect(page.getByTestId("component-input")).toBeVisible();
  await expect(page.getByTestId("component-button")).toBeVisible();
  await expect(page.getByTestId("component-list")).toBeVisible();

  await page.getByTestId("component-input").click();
  await page.locator(".right-panel").getByRole("button", { name: "Advanced" }).click();
  await page.getByLabel("Width", { exact: true }).fill("82%");
  await page.getByRole("button", { name: "mobile" }).click();
  await page.getByLabel("Width", { exact: true }).fill("100%");
  await page.getByLabel("Position X").fill("4px");

  await page.getByRole("button", { name: "Data" }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await expect(
    page.getByText("IndexedDB source created and schema validated"),
  ).toBeVisible();
  await expect(page.locator(".source-card")).toContainText("Local tasks");

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();
  await expect(
    page.getByText("Flow connected to the click and list connected to the source"),
  ).toBeVisible();
  await expect(page.getByLabel("Visual flow editor")).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview
    .getByLabel("New task")
    .fill("Completare il vertical slice");
  await preview.getByRole("button", { name: "Add" }).click();
  await expect(preview.getByText("Completare il vertical slice")).toBeVisible();
  await expect(page.locator(".log-console")).toContainText(
    "Refresh list: completed",
  );
  await page.screenshot({
    path: "artifacts/vertical-slice-running.png",
    fullPage: true,
  });

  await preview.getByRole("button", { name: "Add" }).click();
  await expect(preview.getByRole("alert")).toContainText(
    "Enter a task before adding it",
  );

  await expect(page.getByText("Saved automatically")).toBeVisible({
    timeout: 5_000,
  });
  await page
    .getByRole("button", { name: "Close project and return to the dashboard" })
    .click();
  await page.getByRole("button", { name: /Vertical Slice E2E/ }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Preview isolata"]')
      .getByText("Completare il vertical slice"),
  ).toBeVisible();

  const projectDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const projectDownload = await projectDownloadPromise;
  const projectStream = await projectDownload.createReadStream();
  const projectChunks: Buffer[] = [];
  for await (const chunk of projectStream) projectChunks.push(chunk as Buffer);
  const exportedProject = JSON.parse(
    Buffer.concat(projectChunks).toString("utf8"),
  );
  expect(exportedProject.formatVersion).toBe(1);
  expect(exportedProject.pages[0].components).toHaveLength(4);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files)).toEqual(
    expect.arrayContaining([
      "package.json",
      "src/main.ts",
      "src/style.css",
      "capacitor.config.ts",
    ]),
  );
  const unnamedButtons = await page
    .locator("button")
    .evaluateAll(
      (buttons) =>
        buttons.filter(
          (button) =>
            !(button.textContent?.trim() || button.getAttribute("aria-label")),
        ).length,
    );
  expect(unnamedButtons).toBe(0);
  expect(pageErrors).toEqual([]);

  await page
    .getByRole("button", { name: "Close project and return to the dashboard" })
    .click();
  exportedProject.id = crypto.randomUUID();
  exportedProject.name = "Progetto importato E2E";
  await page
    .getByLabel("Project file to import")
    .setInputFiles({
      name: "project.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exportedProject)),
    });
  await expect(
    page.getByRole("button", { name: /Progetto importato E2E/ }),
  ).toBeVisible();
});

test("plugin dichiarativo contribuisce componenti, nodi, provider e tema in isolamento", async ({
  page,
}) => {
  await page.goto("/");
  const existing = page.getByRole("button", { name: /Vertical Slice E2E/ });
  if (await existing.count()) await existing.click();
  else {
    await page.getByLabel("Project name").fill("Plugin E2E");
    await page
      .getByRole("button", {
        name: "Task list A working vertical slice",
      })
      .click();
  }
  await page.getByRole("button", { name: "Extensions" }).click();
  await page
    .getByRole("button", { name: "Install example plugin" })
    .click();
  await expect(page.getByText("Plugin installed and enabled")).toBeVisible();

  await page.getByRole("button", { name: "Design" }).click();
  const focusCard = page.locator(".palette").getByRole("button", { name: /Focus card/ });
  await expect(focusCard).toBeVisible();
  await focusCard.click();
  await expect(page.getByTestId("component-card").last()).toHaveCSS("background-color", "rgb(16, 42, 47)");

  await page.getByRole("button", { name: "Data" }).click();
  await page.getByRole("button", { name: "Use Local Focus API" }).click();
  await expect(page.locator('input[type="url"]')).toHaveValue("http://127.0.0.1:8787/records");
  await expect(page.getByText("Provider preset loaded: Local Focus API")).toBeVisible();
  await page.getByRole("button", { name: "Connect REST API" }).click();
  await expect(page.getByText("Local Focus API").last()).toBeVisible();

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();
  await expect(page.getByText("Flow connected to the click and list connected to the source")).toBeVisible();
  await expect(page.getByLabel("Nodes provided by extensions")).toBeVisible();
  await page.getByRole("button", { name: "+ Focus notification" }).click();
  await expect(page.locator(".flow-node").filter({ hasText: "Focus notification" })).toBeVisible();

  await page.getByRole("button", { name: "Extensions" }).click();
  await page.getByRole("button", { name: "Apply Focus Theme" }).click();
  await expect(page.getByText("Plugin theme applied: Focus Theme")).toBeVisible();
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.locator(".design-canvas")).toHaveCSS("background-color", "rgb(7, 24, 28)");
  await page.getByTestId("component-card").last().scrollIntoViewIfNeeded();
  await page.mouse.move(800, 650);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/frontend-editor-plugin-contributions.png", fullPage: true });

  await page.getByRole("button", { name: "Extensions" }).click();
  await page.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText("Plugin disabled")).toBeVisible();
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.locator(".palette").getByRole("button", { name: /Focus card/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Extensions" }).click();
  await page.getByRole("button", { name: "Enable" }).click();
  await expect(page.getByText("Plugin enabled")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Plugin removed")).toBeVisible();
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.getByTestId("component-card").last()).toHaveCSS("background-color", "rgb(16, 42, 47)");
});
