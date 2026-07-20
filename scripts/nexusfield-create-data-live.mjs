import { chromium } from "playwright";
import { resolve } from "node:path";

const sources = [
  ["Users & roles", "users", [["name","string"],["email","string"],["role","string"],["organizationId","string"],["avatarUrl","string"],["verified","boolean"]]],
  ["Organizations", "organizations", [["name","string"],["type","string"],["address","string"],["ownerId","string"]]],
  ["Services", "services", [["title","string"],["description","string"],["category","string"],["professionalId","string"],["price","number"],["rating","number"],["available","boolean"],["location","string"]]],
  ["Availability", "availability", [["professionalId","string"],["start","datetime"],["end","datetime"],["status","string"]]],
  ["Quotes", "quotes", [["customerId","string"],["serviceId","string"],["description","string"],["status","string"],["amount","number"],["preferredDate","datetime"]]],
  ["Bookings", "bookings", [["quoteId","string"],["customerId","string"],["professionalId","string"],["employeeId","string"],["status","string"],["scheduledAt","datetime"],["total","number"],["paymentStatus","string"],["signature","string"],["invoiceUrl","string"],["offlinePending","boolean"]]],
  ["Sandbox payments", "payments", [["bookingId","string"],["amount","number"],["status","string"],["transactionId","string"],["refunded","boolean"]]],
  ["Messages", "messages", [["bookingId","string"],["senderId","string"],["body","string"],["attachmentUrl","string"],["sentAt","datetime"],["syncStatus","string"]]],
  ["Inventory", "inventory", [["name","string"],["sku","string"],["quantity","number"],["minQuantity","number"],["barcode","string"],["updatedAt","datetime"]]],
  ["Reviews", "reviews", [["bookingId","string"],["authorId","string"],["rating","number"],["comment","string"],["status","string"],["createdAt","datetime"]]],
  ["Disputes", "disputes", [["bookingId","string"],["reason","string"],["details","string"],["status","string"],["refundAmount","number"],["evidenceUrl","string"],["createdAt","datetime"]]],
  ["Notifications", "notifications", [["userId","string"],["title","string"],["body","string"],["read","boolean"],["scheduledAt","datetime"],["channel","string"]]],
  ["Favorites", "favorites", [["userId","string"],["serviceId","string"],["createdAt","datetime"]]],
  ["Audit trail", "audit", [["actorId","string"],["action","string"],["entity","string"],["entityId","string"],["createdAt","datetime"],["details","string"]]],
  ["Offline queue", "offlineQueue", [["operation","string"],["entity","string"],["payload","string"],["status","string"],["createdAt","datetime"]]],
];
const projectName = process.env.KYRO_PROJECT ?? "NexusField Mobile";
const artifactSuffix = projectName.toLowerCase().includes("web") ? "web" : "mobile";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 80, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: new RegExp(projectName, "i") }).click();
  await page.getByRole("button", { name: "Data" }).click();
  const form = page.locator(".data-layout form.settings-card");
  for (const [sourceName, collection, fields] of sources) {
    if (await page.locator(".source-card").filter({ hasText: sourceName }).count()) continue;
    const removable = form.locator(".schema-row button:not([disabled])");
    while (await removable.count()) await removable.last().click();
    for (const [name, type] of fields) {
      await form.getByRole("button", { name: "+ Add field" }).click();
      const row = form.locator(".schema-row").last();
      await row.getByLabel("Field name").fill(name);
      await row.locator("select").selectOption(type);
    }
    await form.getByLabel("Name", { exact: true }).fill(sourceName);
    await form.getByLabel("Collection", { exact: true }).fill(collection);
    await form.getByRole("button", { name: "Create IndexedDB source" }).click();
    await page.locator(".source-card").filter({ hasText: sourceName }).waitFor();
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", `30-${artifactSuffix}-data-sources.png`), fullPage: true });
  console.log(JSON.stringify({ sources: await page.locator(".source-card").count(), names: await page.locator(".source-card strong").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-create-data.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
