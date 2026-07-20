import { chromium } from "playwright";
import { resolve } from "node:path";

const surfaces = {
  "Public home": [
    ["header", "Public navigation", "NexusField · Services · How it works · Sign in"],
    ["hero", "Public hero", "Trusted professionals, right when you need them", "Compare verified experts, request a transparent quote, and follow every job in one place."],
    ["input", "Public service search", "What service do you need?"], ["button", "Public search action", "Find professionals"],
    ["grid", "Public categories", "Popular services"], ["card", "Home repair category", "Home repair", "Insured technicians near you"], ["card", "Lessons category", "Private lessons", "Verified teachers for every level"], ["card", "Maintenance category", "Maintenance", "Recurring care for homes and teams"],
    ["section", "How it works", "Book with confidence", "Search, compare, approve a quote, and pay safely in the sandbox."], ["button", "Public call to action", "Request your first quote"], ["footer", "Public footer", "NexusField · Privacy · Accessibility · Contact"],
  ],
  "Sign in": [["title", "Sign in title", "Welcome back"], ["form", "Sign in form", "Access NexusField"], ["input", "Sign in email", "Email address"], ["input", "Sign in password", "Password"], ["select", "Sign in role", "Customer"], ["button", "Sign in submit", "Sign in"], ["alert", "Sign in error", "Check your credentials and try again"]],
  Search: [["title", "Search title", "Find a professional"], ["input", "Service search", "Search services, skills, or professionals"], ["select", "Category filter", "All categories"], ["select", "Availability filter", "Any availability"], ["select", "Rating filter", "Any rating"], ["select", "Distance sort", "Nearest first"], ["map", "Search map", "Professionals near you"], ["list", "Search results", "Available professionals"], ["pagination", "Search pagination", "Search result pages"], ["loader", "Search loading", "Finding the best matches…"], ["empty", "Search empty", "No professionals match these filters"], ["alert", "Search error", "Search is temporarily unavailable"]],
  "Service details": [["gallery", "Service gallery", "Recent verified work"], ["title", "Service title", "Heating system inspection"], ["badge", "Verified badge", "Verified professional"], ["card", "Professional profile", "Elena Bianchi · 4.9", "128 completed jobs · usually replies in 8 minutes"], ["text", "Service scope", "Clear scope, included materials, availability, cancellation policy, and transparent price."], ["calendar", "Service availability", "Choose an available time"], ["button", "Favorite service", "Save to favorites"], ["button", "Quote from service", "Request a quote"]],
  "Request quote": [["title", "Quote title", "Request a transparent quote"], ["form", "Quote form", "Project details"], ["input", "Quote subject", "What do you need?"], ["textarea", "Quote description", "Describe the work"], ["select", "Quote priority", "Normal priority"], ["input", "Quote date", "Preferred date"], ["upload", "Quote documents", "Add photos or documents"], ["input", "Coupon code", "Coupon code"], ["button", "Quote submit", "Send quote request"], ["alert", "Quote validation", "Complete all required fields"]],
  Bookings: [["title", "Bookings title", "Bookings & work orders"], ["card", "Upcoming KPI", "12 upcoming"], ["card", "Active KPI", "5 active"], ["card", "Completed KPI", "84 completed"], ["input", "Booking search", "Search bookings"], ["select", "Booking filter", "All statuses"], ["button", "Booking sort", "Sort by date"], ["table", "Booking table", "Bookings"], ["pagination", "Booking pagination", "Booking pages"], ["modal", "Booking detail modal", "Booking details"], ["loader", "Booking loading", "Loading bookings…"], ["empty", "Booking empty", "No bookings here yet"], ["alert", "Booking error", "Bookings could not be loaded"]],
  "Booking details": [["title", "Booking detail title", "Work order details"], ["badge", "Booking detail status", "Accepted"], ["card", "Assigned team", "Elena Bianchi · Field team", "Customer, professional, and manager can follow the same timeline"], ["map", "Booking location", "Job location"], ["card", "Sandbox payment", "€145 protected", "Coupon applied · refundable in sandbox"], ["upload", "Completion evidence", "Add completion photos or documents"], ["signature", "Customer signature", "Customer approval"], ["button", "Complete booking", "Complete work order"], ["button", "Generate invoice", "Generate PDF invoice"], ["button", "Open booking chat", "Open conversation"]],
  Messages: [["title", "Messages title", "Messages"], ["input", "Conversation search", "Search conversations"], ["list", "Conversation list", "Recent conversations"], ["section", "Conversation panel", "Job conversation"], ["list", "Message thread", "Messages"], ["upload", "Message attachment", "Attach a photo or document"], ["input", "Message input", "Write a message"], ["button", "Send message", "Send"], ["toast", "Message success", "Message sent"], ["alert", "Message offline", "Offline: this message will send when connected"]],
  Chat: [["title", "Chat title", "Job conversation"], ["list", "Chat thread", "Messages"], ["upload", "Chat documents", "Attach a photo or document"], ["input", "Chat message", "Write a message"], ["button", "Chat send", "Send message"], ["toast", "Chat sent", "Message sent"], ["alert", "Chat offline", "Offline: queued for synchronization"]],
  Calendar: [["title", "Calendar title", "Team calendar"], ["tabs", "Calendar views", "Day · Week · Month"], ["select", "Team filter", "All team members"], ["calendar", "Operations calendar", "Jobs and appointments"], ["list", "Calendar agenda", "Today’s agenda"], ["button", "Calendar add", "+ Add appointment"]],
  Inventory: [["title", "Inventory title", "Inventory & materials"], ["input", "Inventory search", "Search parts or SKU"], ["select", "Inventory stock filter", "All stock levels"], ["table", "Inventory table", "Parts and materials"], ["pagination", "Inventory pagination", "Inventory pages"], ["button", "Inventory add", "+ Add item"], ["alert", "Inventory low stock", "3 items need restocking"]],
  Reviews: [["title", "Reviews title", "Verified reviews"], ["card", "Review aggregate", "4.9 average rating", "128 reviews from completed bookings"], ["list", "Review list", "Customer reviews"], ["form", "Review form", "Leave a review"], ["select", "Review rating", "5 stars"], ["textarea", "Review comment", "Share your experience"], ["button", "Review submit", "Publish review"], ["toast", "Review success", "Review published"]],
  Disputes: [["title", "Disputes title", "Disputes & refunds"], ["card", "Dispute policy", "Protected resolution", "An administrator reviews evidence before any sandbox refund"], ["table", "Dispute table", "Open cases"], ["form", "Dispute form", "Open a dispute"], ["select", "Dispute reason", "Service not completed"], ["textarea", "Dispute details", "Explain what happened"], ["upload", "Dispute evidence", "Add evidence"], ["button", "Dispute submit", "Submit dispute"], ["modal", "Refund review", "Review sandbox refund"], ["toast", "Dispute success", "Dispute submitted"]],
  Admin: [["title", "Admin title", "Operations control center"], ["card", "Users KPI", "1,248 active users"], ["card", "Jobs KPI", "43 jobs in progress"], ["card", "Volume KPI", "€82k sandbox volume"], ["card", "Disputes KPI", "7 open disputes"], ["input", "Admin search", "Search users, jobs, or disputes"], ["select", "Admin status filter", "All statuses"], ["table", "Admin operations table", "Operations"], ["pagination", "Admin pagination", "Operation pages"], ["modal", "Admin record detail", "Record details"], ["alert", "Admin unauthorized", "You do not have permission to view this area"]],
  Reports: [["title", "Reports title", "Performance & insights"], ["select", "Report range", "Last 30 days"], ["card", "Completion KPI", "96% completion rate"], ["card", "Rating KPI", "4.9 customer rating"], ["card", "Response KPI", "8 min response time"], ["card", "Revenue KPI", "€82k sandbox volume"], ["chart", "Jobs chart", "Jobs completed"], ["chart", "Revenue chart", "Sandbox revenue"], ["table", "Team report table", "Team performance"], ["button", "Export report", "Export accessible report"]],
  Settings: [["title", "Settings title", "Workspace settings"], ["select", "Theme setting", "Theme"], ["checkbox", "Offline setting", "Keep data available offline"], ["checkbox", "Notification setting", "Realtime and local notifications"], ["checkbox", "Location setting", "Use location for nearby services"], ["select", "Language setting", "English"], ["button", "Create backup", "Create backup"], ["button", "Restore backup", "Restore backup"], ["button", "Sign out", "Sign out"]],
};

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 80, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
const right = page.locator(".right-panel");
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactEnd = (value) => new RegExp(`${escape(value)}\\s*$`, "i");
async function fill(label, value) { const field = right.locator("label").filter({ hasText: label }).first().locator("input,textarea").first(); if (await field.count()) await field.fill(value); }
async function add(type, name, label, description, parentName) {
  if (await page.locator(".layers button").filter({ hasText: exactEnd(name) }).count()) return;
  const paletteName = type === "grid" ? "Columns" : type;
  await page.locator(".palette button").filter({ hasText: exactEnd(paletteName) }).first().click();
  await fill("Element name", name); await fill("Text or label", label); if (description) await fill("Description", description);
  const parent = right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select"); if (await parent.count()) await parent.selectOption({ label: parentName }).catch(() => undefined);
  const surfaces = ["card", "form", "list", "table", "map", "calendar", "chart", "gallery", "section", "grid", "modal"];
  const bg = type === "button" ? "#20C7C9" : surfaces.includes(type) ? "#171A1F" : "transparent";
  const fg = type === "button" ? "#071012" : "#F3F4F6";
  const background = right.getByLabel("Background color value").first(), color = right.getByLabel("Text color value").first();
  if (await background.count()) await background.fill(bg); if (await color.count()) await color.fill(fg);
  if (await right.getByLabel("Quick corners").count()) await right.getByLabel("Quick corners").fill(["title", "text", "link"].includes(type) ? "0" : "16");
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  await page.getByRole("button", { name: "Desktop" }).click();
  for (const [pageName, components] of Object.entries(surfaces)) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    const rootName = `${pageName} content`;
    const pageColor = right.getByLabel("Page color value"); if (await pageColor.count()) await pageColor.fill("#0F1115");
    for (const [type, name, label, description = ""] of components) await add(type, name, label, description, rootName);
  }
  await page.locator(".page-list button").filter({ hasText: "Public home" }).first().click();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "28-web-surfaces.png"), fullPage: true });
  console.log(JSON.stringify({ authoredPages: Object.keys(surfaces).length, currentLayers: await page.locator(".layers button").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-surfaces.png"), fullPage: true }); throw error; }
finally { await context.close(); }
