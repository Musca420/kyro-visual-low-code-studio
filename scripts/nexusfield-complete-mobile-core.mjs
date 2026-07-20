import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 120,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
const right = page.locator(".right-panel");
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactEnd = (value) => new RegExp(`${escape(value)}\\s*$`, "i");

async function openProject() {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count()))
    await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.getByRole("button", { name: "mobile" }).click();
}

async function selectPage(name) {
  await page.locator(".page-list button").filter({ hasText: new RegExp(escape(name), "i") }).first().click();
  await page.waitForTimeout(250);
}

async function selectLayer(names) {
  for (const name of Array.isArray(names) ? names : [names]) {
    const candidate = page.locator(".layers button").filter({ hasText: exactEnd(name) }).first();
    if (await candidate.count()) return candidate.click();
  }
  throw new Error(`Layer not found: ${(Array.isArray(names) ? names : [names]).join(", ")}`);
}

async function fill(label, value) {
  const field = right.locator("label").filter({ hasText: label }).first().locator("input,textarea").first();
  if (await field.count()) await field.fill(value);
}

async function restyle(background, color = "#F3F4F6", corners = "16") {
  const backgroundField = right.getByLabel("Background color value").first();
  const textField = right.getByLabel("Text color value").first();
  if (await backgroundField.count()) await backgroundField.fill(background);
  if (await textField.count()) await textField.fill(color);
  if (await right.getByLabel("Quick corners").count()) await right.getByLabel("Quick corners").fill(corners);
}

async function rename(oldName, name, label, description = "") {
  await selectLayer([oldName, name]);
  await fill("Element name", name);
  await fill("Text or label", label);
  if (description) await fill("Description", description);
}

async function add(type, name, label, parentName, options = {}) {
  if (await page.locator(".layers button").filter({ hasText: exactEnd(name) }).count()) return;
  await page.locator(".palette button").filter({ hasText: exactEnd(type) }).first().click();
  await fill("Element name", name);
  await fill("Text or label", label);
  if (options.description) await fill("Description", options.description);
  const parent = right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select");
  if (parentName && await parent.count()) await parent.selectOption({ label: parentName });
  await restyle(options.background ?? (type === "button" ? "#20C7C9" : ["card", "form", "list", "map"].includes(type) ? "#171A1F" : "transparent"), options.color ?? (type === "button" ? "#071012" : "#F3F4F6"), options.corners ?? (["title", "text", "link"].includes(type) ? "0" : "16"));
  const animation = right.getByLabel(/Animation/i);
  if (await animation.count()) await animation.selectOption({ label: "Rise" }).catch(() => undefined);
}

try {
  await openProject();

  await selectPage("Home");
  await rename("Header", "NexusField header", "NexusField · Rome");
  await restyle("#0F1115", "#F3F4F6", "0");
  await rename("Home intro", "Customer welcome", "Good morning, Alex", "What can we help you get done today?");
  await restyle("#102B2D", "#F3F4F6", "22");
  await rename("Home grid", "Popular services", "Popular services");
  await restyle("#0F1115", "#F3F4F6", "0");
  const cards = [
    ["Home card 1", "Plumbing category", "Plumbing · from €45", "Verified professionals near you"],
    ["Home card 2", "Lessons category", "Private lessons · from €25", "Teachers available today"],
    ["Home card 3", "Maintenance category", "Home maintenance · from €55", "Fast, insured service"],
  ];
  for (const [oldName, name, label, description] of cards) {
    await rename(oldName, name, label, description);
    await restyle("#171A1F", "#F3F4F6", "18");
  }
  await rename("Footer", "Trust footer", "Verified professionals · Secure sandbox payments");
  await restyle("#171A1F", "#F3F4F6", "18");
  await add("input", "Service finder", "Search a service or professional", "Customer welcome");
  await add("button", "Search services", "Find professionals", "Customer welcome");
  await add("card", "Upcoming booking", "Tomorrow · 09:30 · Boiler inspection", "Customer welcome", { description: "Accepted · Marco Rossi · Protected sandbox payment", background: "#1D2229" });
  await add("map", "Nearby professionals", "Professionals near you", "Popular services", { background: "#171A1F" });
  await add("button", "Open bookings", "View all bookings", "Popular services", { background: "#FF7A59", color: "#111318" });
  await add("loader", "Home loading", "Loading your dashboard…", "Popular services");
  await add("empty", "Home empty", "No bookings yet. Find your first professional.", "Popular services");
  await add("alert", "Home error", "We could not update your dashboard. Try again.", "Popular services");

  await selectPage("Tasks");
  await rename("Header", "Jobs header", "Work orders");
  await restyle("#0F1115", "#F3F4F6", "0");
  await rename("Tasks intro", "Jobs summary", "Today in the field", "Track assignments, materials, signatures, and customer updates.");
  await restyle("#102B2D", "#F3F4F6", "22");
  await rename("Tasks grid", "Job board", "Assigned jobs");
  await restyle("#0F1115", "#F3F4F6", "0");
  const jobCards = [
    ["Tasks card 1", "Urgent job", "08:30 · Heating repair", "High priority · Assigned to Elena"],
    ["Tasks card 2", "Scheduled job", "11:00 · Math lesson", "Confirmed · Customer notified"],
    ["Tasks card 3", "Completed job", "14:30 · Window maintenance", "Awaiting customer signature"],
  ];
  for (const [oldName, name, label, description] of jobCards) {
    await rename(oldName, name, label, description);
    await restyle("#171A1F", "#F3F4F6", "18");
  }
  await rename("Footer", "Offline status", "Offline ready · Last sync just now");
  await restyle("#171A1F", "#F3F4F6", "18");
  await add("input", "Job search", "Search work orders", "Job board");
  await add("select", "Job status filter", "All statuses", "Job board");
  await add("list", "Work order list", "Live work orders", "Job board", { background: "#171A1F" });
  await add("button", "Create work order", "+ Create work order", "Jobs summary");
  await add("toast", "Job confirmation", "Work order updated", "Job board");
  await add("alert", "Jobs error", "Work orders could not be synchronized", "Job board");

  await selectPage("Profile");
  await rename("Header", "Profile header", "Professional profile");
  await restyle("#0F1115", "#F3F4F6", "0");
  await rename("Profile intro", "Profile summary", "Elena Bianchi", "Verified technician · 4.9 rating · 128 completed jobs");
  await restyle("#102B2D", "#F3F4F6", "22");
  await rename("Profile grid", "Profile controls", "Business & team");
  await restyle("#0F1115", "#F3F4F6", "0");
  const profileCards = [
    ["Profile card 1", "Organization profile", "Bianchi Technical Services", "4 team members · Rome"],
    ["Profile card 2", "Availability profile", "Available this week", "Mon–Fri · 08:00–18:00"],
    ["Profile card 3", "Performance profile", "96% completion rate", "Average response · 8 minutes"],
  ];
  for (const [oldName, name, label, description] of profileCards) {
    await rename(oldName, name, label, description);
    await restyle("#171A1F", "#F3F4F6", "18");
  }
  await rename("Footer", "Profile privacy", "Your profile and team permissions are under your control");
  await restyle("#171A1F", "#F3F4F6", "18");
  await add("gallery", "Work portfolio", "Recent work", "Profile controls", { background: "#171A1F" });
  await add("upload", "Identity documents", "Upload images or documents", "Profile controls");
  await add("button", "Edit professional profile", "Edit profile", "Profile summary");
  await add("button", "Manage team", "Manage team & permissions", "Profile controls", { background: "#FF7A59", color: "#111318" });

  await selectPage("Home");
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "25-mobile-core-authored.png"), fullPage: true });
  console.log(JSON.stringify({ page: "Home", layers: await page.locator(".layers button").allTextContents() }, null, 2));
  await page.waitForTimeout(4000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-mobile-core.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
}
