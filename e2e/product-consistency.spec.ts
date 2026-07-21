import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { portableRuntimeSnapshot } from "../src/productConsistency";

const plan = (componentId: string, pageId: string) => JSON.stringify({
  summary: "Rename the selected visual button",
  skill: "kyro-design",
  operations: [{ type: "set_component_property", pageId, argsJson: JSON.stringify({ componentId, property: "label", value: "Continue with Codex" }) }],
  checks: ["Preview and export show the same button"],
  confirmations: [],
  alreadySatisfied: false,
  capabilityProposal: null,
});

test("manual, Codex, Preview, Export and exact reimport keep one product", async ({ page, request }) => {
  test.setTimeout(90_000);
  const name = `Consistency ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();

  await page.locator(".palette button").filter({ hasText: "title" }).click();
  await page.getByLabel("Text or label").fill("One visual product");
  await page.locator(".palette button").filter({ hasText: "button" }).click();
  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  await expect.poll(async () => (await request.get(`/api/live/status?projectId=${projectId}`)).status()).toBe(200);
  const live = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const componentId = live.selectedComponentIds[0] as string;

  const jobResponse = await request.post("/api/codex/jobs", { data: {
    mode: "apply",
    prompt: "Rename the selected button to Continue with Codex",
    approvedPlan: plan(componentId, live.pageId),
    projectId: live.projectId,
    revision: live.revision,
    focus: { kind: "component", pageId: live.pageId, componentId },
  } });
  expect(jobResponse.status()).toBe(202);
  const job = await jobResponse.json();
  await expect.poll(async () => (await (await request.get(`/api/codex/jobs/${job.jobId}`)).json()).status).toBe("completed");
  await expect(page.getByTestId("component-button")).toContainText("Continue with Codex");

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(preview.getByRole("heading", { name: "One visual product" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Continue with Codex" })).toBeVisible();

  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const firstPath = join(process.cwd(), "artifacts", "product-consistency-first.zip");
  await (await firstDownload).saveAs(firstPath);
  const firstZip = await JSZip.loadAsync(await readFile(firstPath));
  const firstFiles = Object.fromEntries(await Promise.all(["project.kyro.json", "runtime-program.json", "index.html", "src/main.ts", "src/style.css", "package.json"].map(async (path) => [path, await firstZip.file(path)!.async("string")] as const)));
  const exportText = Object.values(firstFiles).join("\n");
  expect(exportText).not.toContain(job.jobId);
  expect(exportText).not.toContain("approved_job");

  const importRoot = join(process.cwd(), "test-results", `product-consistency-import-${Date.now()}`);
  await Promise.all(Object.entries(firstFiles).map(async ([path, content]) => {
    const target = join(importRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }));

  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.locator("input[webkitdirectory]").setInputFiles(importRoot);
  await expect(page.getByLabel("Project name")).toHaveValue(name);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview.getByRole("heading", { name: "One visual product" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Continue with Codex" })).toBeVisible();

  const secondDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const secondPath = join(process.cwd(), "artifacts", "product-consistency-reimport.zip");
  await (await secondDownload).saveAs(secondPath);
  const secondZip = await JSZip.loadAsync(await readFile(secondPath));
  const secondRuntime = JSON.parse(await secondZip.file("runtime-program.json")!.async("string"));
  expect(portableRuntimeSnapshot(secondRuntime)).toEqual(portableRuntimeSnapshot(JSON.parse(firstFiles["runtime-program.json"])));
  expect(await secondZip.file("index.html")!.async("string")).toBe(firstFiles["index.html"]);
  await page.screenshot({ path: "artifacts/product-consistency-round-trip.png", fullPage: true });
});
