import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const work = resolve(root, ".kyro", "benchmarks", "evaluation-prompts-10");
await mkdir(work, { recursive: true });
const browser = await chromium.launch({ headless: false, slowMo: 550 });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));

const openPreview = async () => {
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Preview isolata"]');
  await frame.locator("body").waitFor();
  return frame;
};

try {
  await page.goto("http://127.0.0.1:43129", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Project file to import").setInputFiles(resolve(work, "checkpoint-10.json"));
  await page.getByRole("button", { name: "Kyro Evaluation Tasks" }).click();
  let frame = await openPreview();
  const title = frame.getByLabel("Task title");
  const create = frame.getByRole("button", { name: "Create Task" });
  const titleComponentId = await title.getAttribute("data-component");

  await title.fill("ab");
  await create.click();
  await frame.locator("[data-flow-status]").waitFor({ state: "visible" });
  const invalidMessage = await frame.locator("[data-flow-status]").innerText();
  const focusedAfterError = await frame.locator(":focus").getAttribute("data-component");
  if (focusedAfterError !== titleComponentId) throw new Error(`Invalid submit focused ${focusedAfterError || "nothing"}`);

  await title.fill("Benchmark task");
  await frame.getByLabel("Due date").fill("2026-07-22");
  await create.click();
  await frame.getByText("Benchmark task", { exact: true }).waitFor();
  const listText = await frame.locator('[data-kind="list"]').innerText();
  if (!listText.includes("7/22/2026") && !listText.includes("22/07/2026")) throw new Error("The optional due date is not visible in the list");

  const status = frame.getByLabel("Filter by Status");
  await status.selectOption({ label: "Done" });
  await frame.getByText("0 visible tasks", { exact: true }).waitFor();
  await frame.getByText("No tasks match these filters.", { exact: true }).waitFor({ state: "visible" });
  await status.selectOption({ label: "All" });
  await frame.getByText("1 visible tasks", { exact: true }).waitFor();
  await frame.getByText("Benchmark task", { exact: true }).waitFor();

  await page.screenshot({ path: resolve(work, "verified-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "mobile", exact: true }).click();
  frame = page.frameLocator('iframe[title="Preview isolata"]');
  const mobileMetrics = await frame.locator("body").evaluate((body) => ({ scrollWidth: body.scrollWidth, clientWidth: body.clientWidth }));
  if (mobileMetrics.scrollWidth > mobileMetrics.clientWidth) throw new Error(`Mobile overflow ${mobileMetrics.scrollWidth}/${mobileMetrics.clientWidth}`);
  await page.screenshot({ path: resolve(work, "verified-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  await (await download).saveAs(resolve(work, "verified-final.zip"));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Kyro Evaluation Tasks" }).click();
  frame = await openPreview();
  await frame.getByText("Benchmark task", { exact: true }).waitFor();

  const evidence = { invalidMessage, focusedAfterError, listText, mobileMetrics, persistedAfterReload: true, errors };
  if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
  await writeFile(resolve(work, "visual-verification.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await context.close();
  await browser.close();
}
