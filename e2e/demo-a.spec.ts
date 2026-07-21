import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import JSZip from "jszip";

const plan = (componentId: string, pageId: string) => JSON.stringify({
  summary: "Clarify the imported call to action",
  skill: "kyro-design",
  operations: [{ type: "set_component_property", pageId, argsJson: JSON.stringify({ componentId, property: "label", value: "Explore the certified work" }) }],
  checks: ["The imported heading remains visible", "Preview and export show the same call to action"],
  confirmations: [], alreadySatisfied: false, capabilityProposal: null,
});

test("Demo A: an existing project survives manual and Codex editing, export and standalone execution", async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  const root = process.cwd(), fixture = join(root, "e2e", "fixtures", "react-import");
  await page.goto("/");
  await page.locator("input[webkitdirectory]").setInputFiles(fixture);
  await expect(page.locator(".import-source-banner")).toContainText("React");

  await page.getByTestId("component-title").click();
  await page.getByLabel("Text or label").fill("Kyro Certified Portfolio");
  await page.getByTestId("component-button").click();
  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  await expect.poll(async () => (await request.get(`/api/live/status?projectId=${projectId}`)).status()).toBe(200);
  const live = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const componentId = live.selectedComponentIds[0] as string;
  const response = await request.post("/api/codex/jobs", { data: {
    mode: "apply", prompt: "Clarify this imported button for visitors", approvedPlan: plan(componentId, live.pageId),
    projectId: live.projectId, revision: live.revision, focus: { kind: "component", pageId: live.pageId, componentId },
  } });
  expect(response.status()).toBe(202);
  const job = await response.json();
  await expect.poll(async () => (await (await request.get(`/api/codex/jobs/${job.jobId}`)).json()).status, { timeout: 30_000 }).toBe("completed");

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(preview.getByRole("heading", { name: "Kyro Certified Portfolio" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Explore the certified work" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const archive = join(root, "artifacts", "demo-a-existing-project.zip");
  await (await download).saveAs(archive);
  const zip = await JSZip.loadAsync(await readFile(archive));
  const exportRoot = join(root, "test-results", `demo-a-export-${Date.now()}`);
  for (const [relative, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = normalize(join(exportRoot, relative));
    expect(target.startsWith(`${normalize(exportRoot)}${sep}`)).toBe(true);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await entry.async("nodebuffer"));
  }
  const exportedText = await zip.file("project.kyro.json")!.async("string");
  expect(exportedText).not.toContain(job.jobId);
  expect(exportedText).not.toContain("approved_job");

  const vite = join(root, "node_modules", "vite", "bin", "vite.js"), port = 4196;
  const server = spawn(process.execPath, [vite, "--host", "127.0.0.1", "--port", String(port)], { cwd: exportRoot, stdio: "ignore" });
  try {
    await expect.poll(async () => fetch(`http://127.0.0.1:${port}`).then((value) => value.status).catch(() => 0), { timeout: 15_000 }).toBe(200);
    const standalone = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await standalone.goto(`http://127.0.0.1:${port}`);
    await expect(standalone.getByRole("heading", { name: "Kyro Certified Portfolio" })).toBeVisible();
    await expect(standalone.getByRole("button", { name: "Explore the certified work" })).toBeVisible();
    await standalone.screenshot({ path: "artifacts/demo-a-standalone.png", fullPage: true });
    await standalone.close();
  } finally {
    server.kill();
  }
});
