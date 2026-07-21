import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:43130";
const output = process.argv[3] ?? ".kyro/benchmarks/evaluation-prompts-10/export-runtime";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false, slowMo: 500 });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Task title").fill("Exported task");
  await page.getByLabel("Due date").fill("2026-07-23");
  await page.getByRole("button", { name: "Create Task" }).click();
  await page.getByText("Exported task", { exact: true }).waitFor();
  const listText = await page.locator('[data-kind="list"]').innerText();
  if (!listText.includes("7/23/2026") && !listText.includes("23/07/2026")) throw new Error("Exported runtime did not render the due date");
  await page.getByLabel("Filter by Status").selectOption({ label: "Done" });
  await page.getByText("0 visible tasks", { exact: true }).waitFor();
  await page.getByText("No tasks match these filters.", { exact: true }).waitFor({ state: "visible" });
  await page.getByLabel("Filter by Status").selectOption({ label: "All" });
  await page.getByText("Exported task", { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const metrics = await page.locator("body").evaluate((body) => ({ scrollWidth: body.scrollWidth, clientWidth: body.clientWidth }));
  if (metrics.scrollWidth > metrics.clientWidth) throw new Error(`Exported mobile overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Exported task", { exact: true }).waitFor();
  if (errors.length) throw new Error(`Exported runtime errors: ${errors.join(" | ")}`);
  const evidence = { listText, metrics, persistedAfterReload: true, errors };
  await writeFile(`${output}/result.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await context.close();
  await browser.close();
}
