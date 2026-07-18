import { expect, test } from "@playwright/test";
import JSZip from "jszip";

test("vertical slice: progetto, builder, flow, IndexedDB, persistenza ed export", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Vertical Slice E2E");
  await page
    .getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" })
    .click();

  await page
    .getByRole("button", { name: "Aggiungi pagina", exact: true })
    .click();
  const palette = page.locator(".palette");
  const canvas = page.locator(".design-canvas");
  await palette.getByRole("button", { name: "⌨ input" }).dragTo(canvas);
  await palette.getByRole("button", { name: "● button" }).dragTo(canvas);
  await palette.getByRole("button", { name: "≡ list" }).dragTo(canvas);
  await expect(page.getByTestId("component-input")).toBeVisible();
  await expect(page.getByTestId("component-button")).toBeVisible();
  await expect(page.getByTestId("component-list")).toBeVisible();

  await page.getByTestId("component-input").click();
  await page.locator(".right-panel").getByRole("button", { name: "Avanzata" }).click();
  await page.getByLabel("Larghezza").fill("82%");
  await page.getByRole("button", { name: "mobile" }).click();
  await page.getByLabel("Larghezza").fill("100%");
  await page.getByLabel("Posizione X").fill("4px");

  await page.getByRole("button", { name: "Dati" }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await expect(
    page.getByText("Sorgente IndexedDB creata e schema validato"),
  ).toBeVisible();
  await expect(page.locator(".source-card")).toContainText("Attività locali");

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  await expect(
    page.getByText("Flow collegato al click e lista collegata alla sorgente"),
  ).toBeVisible();
  await expect(page.getByLabel("Editor grafico del flow")).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview
    .getByLabel("Nuova attività")
    .fill("Completare il vertical slice");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(preview.getByText("Completare il vertical slice")).toBeVisible();
  await expect(page.locator(".log-console")).toContainText(
    "Aggiorna lista: completato",
  );
  await page.screenshot({
    path: "artifacts/vertical-slice-running.png",
    fullPage: true,
  });

  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(preview.getByRole("alert")).toContainText(
    "Scrivi un’attività prima di aggiungerla",
  );

  await expect(page.getByText("Salvato automaticamente")).toBeVisible({
    timeout: 5_000,
  });
  await page
    .getByRole("button", { name: "Chiudi progetto e torna alla dashboard" })
    .click();
  await page.getByRole("button", { name: /Vertical Slice E2E/ }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Preview isolata"]')
      .getByText("Completare il vertical slice"),
  ).toBeVisible();

  const projectDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta JSON" }).click();
  const projectDownload = await projectDownloadPromise;
  const projectStream = await projectDownload.createReadStream();
  const projectChunks: Buffer[] = [];
  for await (const chunk of projectStream) projectChunks.push(chunk as Buffer);
  const exportedProject = JSON.parse(
    Buffer.concat(projectChunks).toString("utf8"),
  );
  expect(exportedProject.formatVersion).toBe(1);
  expect(exportedProject.pages[0].components).toHaveLength(3);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta app" }).click();
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
    .getByRole("button", { name: "Chiudi progetto e torna alla dashboard" })
    .click();
  exportedProject.id = crypto.randomUUID();
  exportedProject.name = "Progetto importato E2E";
  await page
    .getByLabel("File progetto da importare")
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
    await page.getByLabel("Nome progetto").fill("Plugin E2E");
    await page
      .getByRole("button", {
        name: "Lista attività Vertical slice già configurato",
      })
      .click();
  }
  await page.getByRole("button", { name: "Plugin" }).click();
  await page
    .getByRole("button", { name: "Installa plugin di esempio" })
    .click();
  await expect(page.getByText("Plugin installato e abilitato")).toBeVisible();

  await page.getByRole("button", { name: "Design" }).click();
  const focusCard = page.locator(".palette").getByRole("button", { name: /Focus card/ });
  await expect(focusCard).toBeVisible();
  await focusCard.click();
  await expect(page.getByTestId("component-card").last()).toHaveCSS("background-color", "rgb(16, 42, 47)");

  await page.getByRole("button", { name: "Dati" }).click();
  await page.getByRole("button", { name: "Usa Focus API locale" }).click();
  await expect(page.locator('input[type="url"]')).toHaveValue("http://127.0.0.1:8787/records");
  await expect(page.getByText("Preset provider caricato: Focus API locale")).toBeVisible();
  await page.getByRole("button", { name: "Collega API REST" }).click();
  await expect(page.getByText("Focus API locale").last()).toBeVisible();

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  await expect(page.getByText("Flow collegato al click e lista collegata alla sorgente")).toBeVisible();
  await expect(page.getByLabel("Nodi forniti dai plugin")).toBeVisible();
  await page.getByRole("button", { name: "+ Notifica focus" }).click();
  await expect(page.locator(".flow-node").filter({ hasText: "Notifica focus" })).toBeVisible();

  await page.getByRole("button", { name: "Plugin" }).click();
  await page.getByRole("button", { name: "Applica Tema Focus" }).click();
  await expect(page.getByText("Tema plugin applicato: Tema Focus")).toBeVisible();
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.locator(".design-canvas")).toHaveCSS("background-color", "rgb(7, 24, 28)");
  await page.getByTestId("component-card").last().scrollIntoViewIfNeeded();
  await page.mouse.move(800, 650);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/frontend-editor-plugin-contributions.png", fullPage: true });

  await page.getByRole("button", { name: "Plugin" }).click();
  await page.getByRole("button", { name: "Disabilita" }).click();
  await expect(page.getByText("Plugin disabilitato")).toBeVisible();
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.locator(".palette").getByRole("button", { name: /Focus card/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Plugin" }).click();
  await page.getByRole("button", { name: "Abilita" }).click();
  await expect(page.getByText("Plugin abilitato")).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi" }).click();
  await expect(page.getByText("Plugin rimosso")).toBeVisible();
  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.getByTestId("component-card").last()).toHaveCSS("background-color", "rgb(16, 42, 47)");
});
