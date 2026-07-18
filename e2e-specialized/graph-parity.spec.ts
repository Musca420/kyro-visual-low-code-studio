import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const [name, url] of [["landing", "http://127.0.0.1:4281"], ["dashboard", "http://127.0.0.1:4282"]] as const) {
  test(`il flow personalizzato resta attivo nell'export ${name}`, async ({ page }) => {
    const project = JSON.parse(readFileSync(resolve("out", `experience-${name}`, "project.frontend-editor.json"), "utf8"));
    const component = project.pages.flatMap((item: { components: Array<{ id: string; events: Record<string, string> }> }) => item.components).find((item: { events: Record<string, string> }) => Object.keys(item.events).length);
    await page.goto(url);
    const button = page.locator(`[data-component="${component.id}"]`);
    await button.click();
    await expect(button).toHaveText("Flow eseguito");
  });
}
