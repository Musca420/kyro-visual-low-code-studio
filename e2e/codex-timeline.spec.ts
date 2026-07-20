import { expect, test } from "@playwright/test";

test("la timeline Codex conserva revisione, prove, test e ripristino", async ({ page }) => {
  const jobs = new Map<string, "plan" | "apply">();
  let sequence = 0;
  await page.route("**/api/codex/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/codex/status") {
      return route.fulfill({ json: { authenticated: true, message: "Accesso attivo", workspace: "C:/workspace" } });
    }
    if (url.pathname === "/api/codex/jobs" && request.method() === "POST") {
      const input = request.postDataJSON() as { mode: "plan" | "apply" };
      const id = `timeline-job-${++sequence}`;
      jobs.set(id, input.mode);
      return route.fulfill({ status: 202, json: { jobId: id, status: "running" } });
    }
    const match = url.pathname.match(/^\/api\/codex\/jobs\/([^/]+)$/);
    if (match && request.method() === "GET") {
      const mode = jobs.get(match[1]) ?? "plan";
      const output = [
        JSON.stringify({ item: { type: "agent_message", text: mode === "apply" ? "Modifica applicata e verificata." : "Piano semplice pronto." } }),
        JSON.stringify({ item: { type: "command_execution", status: "completed", command: "npm run test", aggregated_output: "31 test superati", exit_code: 0 } }),
      ].join("\n");
      return route.fulfill({ json: {
        id: match[1], status: "completed", output, errors: "",
        changedFiles: mode === "apply" ? ["src/App.tsx"] : [],
        git: { status: mode === "apply" ? " M src/App.tsx\n" : "", diff: mode === "apply" ? "+colore aggiornato" : "" },
      } });
    }
    if (url.pathname.endsWith("/restore") && request.method() === "POST") {
      return route.fulfill({ json: { restored: ["src/App.tsx"] } });
    }
    return route.fulfill({ status: 404, json: { error: "Rotta test non prevista" } });
  });

  await page.goto("/");
  await page.getByLabel("Project name").fill("Timeline Codex");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: "button" }).click();
  const component = page.getByTestId("component-button");
  await component.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const panel = page.getByRole("region", { name: "Codex assistant" });
  await panel.getByLabel("Request in plain language").fill("Rendi questo pulsante più chiaro e verifica il risultato.");
  await panel.getByRole("button", { name: "Analyze request" }).click();
  await expect(panel.getByText("Plan to approve")).toBeVisible();
  await panel.getByRole("button", { name: "Approve and apply" }).click();
  await expect(panel.getByText("Plan to approve")).toHaveCount(0);
  const restore = panel.getByRole("button", { name: "Restore", exact: true });
  await expect(restore).toBeVisible();
  await restore.click();

  await panel.getByRole("button", { name: /Timeline/ }).click();
  await expect(panel.locator(".codex-timeline > article")).toHaveCount(2);
  await expect(panel.locator(".timeline-images img")).toHaveCount(2);
  await expect(panel.getByText("restored", { exact: true })).toBeVisible();
  await expect(panel.getByText("1/1 tests passed").first()).toBeVisible();

  await panel.getByRole("button", { name: "Close Codex panel" }).click();
  await component.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const reopened = page.getByRole("region", { name: "Codex assistant" });
  await reopened.getByRole("button", { name: /Timeline/ }).click();
  await expect(reopened.locator(".codex-timeline > article")).toHaveCount(2);
  await page.screenshot({ path: "artifacts/frontend-editor-codex-timeline.png", fullPage: true });
});
