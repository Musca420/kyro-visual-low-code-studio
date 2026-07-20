import { chromium } from "playwright";
import { resolve } from "node:path";

const surfaces = {
  Onboarding: [
    ["title", "Welcome title", "Field service, without the friction"], ["text", "Welcome copy", "Find trusted professionals, book work, and follow every job from quote to review."],
    ["card", "Discover card", "Discover nearby experts"], ["card", "Track card", "Track every booking"], ["card", "Offline card", "Keep working offline"], ["button", "Get started", "Get started"],
  ],
  "Sign in": [["title", "Sign in title", "Welcome back"], ["text", "Sign in copy", "Sign in as a customer, professional, employee, manager, or administrator."], ["input", "Email", "Email address"], ["input", "Password", "Password"], ["button", "Sign in action", "Sign in"], ["link", "Create account", "Create an account"]],
  Search: [["title", "Search title", "Find the right professional"], ["input", "Service search", "Search services or professionals"], ["select", "Category filter", "Category"], ["select", "Availability filter", "Availability"], ["select", "Distance sort", "Sort by distance"], ["map", "Nearby map", "Nearby professionals"], ["list", "Search results", "Available services"], ["loader", "Search loading", "Finding professionals…"], ["empty", "Search empty", "No professionals match these filters"], ["alert", "Search error", "Search is temporarily unavailable"]],
  "Service details": [["title", "Service title", "Service details"], ["gallery", "Service gallery", "Recent work"], ["card", "Professional summary", "Verified professional · 4.9 rating"], ["text", "Service description", "Transparent scope, materials, availability, and pricing."], ["calendar", "Service availability", "Available times"], ["button", "Favorite service", "Save to favorites"], ["button", "Request service quote", "Request a quote"]],
  "Request quote": [["title", "Quote title", "Request a quote"], ["form", "Quote form", "Project details"], ["input", "Quote subject", "What do you need?"], ["textarea", "Quote description", "Describe the work"], ["select", "Quote priority", "Priority"], ["input", "Preferred date", "Preferred date"], ["upload", "Quote attachments", "Add photos or documents"], ["button", "Submit quote", "Send quote request"], ["alert", "Quote validation", "Complete the required fields"]],
  Bookings: [["title", "Bookings title", "Your bookings"], ["tabs", "Booking status tabs", "Upcoming · Active · Completed"], ["input", "Booking search", "Search bookings"], ["list", "Booking list", "Bookings"], ["calendar", "Booking calendar", "Schedule"], ["loader", "Bookings loading", "Loading bookings…"], ["empty", "Bookings empty", "No bookings here yet"], ["alert", "Bookings error", "Bookings could not be loaded"]],
  "Booking details": [["title", "Booking detail title", "Job details"], ["badge", "Booking status", "Accepted"], ["card", "Booking professional", "Professional and assigned team"], ["map", "Job location", "Job location"], ["card", "Quote summary", "Approved quote · sandbox payment protected"], ["button", "Open job chat", "Open chat"], ["button", "Complete job", "Complete job"], ["button", "Cancel booking", "Cancel booking"]],
  Messages: [["title", "Messages title", "Messages"], ["input", "Conversation search", "Search conversations"], ["list", "Conversation list", "Recent conversations"], ["loader", "Messages loading", "Loading messages…"], ["empty", "Messages empty", "No conversations yet"], ["alert", "Messages error", "Messages are unavailable"]],
  Chat: [["title", "Chat title", "Job conversation"], ["list", "Chat messages", "Messages"], ["upload", "Chat attachment", "Attach a photo or document"], ["input", "Chat input", "Write a message"], ["button", "Send message", "Send"], ["toast", "Message sent", "Message sent"], ["alert", "Chat offline", "Offline: your message will send when connected"]],
  Calendar: [["title", "Calendar title", "Field calendar"], ["tabs", "Calendar views", "Day · Week"], ["calendar", "Team calendar", "Jobs and appointments"], ["list", "Calendar agenda", "Today’s agenda"], ["button", "Add appointment", "Add appointment"]],
  Inventory: [["title", "Inventory title", "Inventory"], ["input", "Inventory search", "Search parts and materials"], ["select", "Stock filter", "Stock status"], ["list", "Inventory list", "Parts and materials"], ["button", "Scan inventory code", "Scan QR or barcode"], ["button", "Add inventory item", "Add item"], ["empty", "Inventory empty", "No inventory items"]],
  Reviews: [["title", "Reviews title", "Reviews"], ["card", "Review summary", "4.9 average · 128 verified reviews"], ["list", "Review list", "Customer reviews"], ["form", "Review form", "Leave a review"], ["select", "Review rating", "Rating"], ["textarea", "Review text", "Share your experience"], ["button", "Submit review", "Publish review"]],
  Disputes: [["title", "Disputes title", "Disputes & refunds"], ["list", "Dispute list", "Open cases"], ["form", "Dispute form", "Open a dispute"], ["select", "Dispute reason", "Reason"], ["textarea", "Dispute details", "Explain what happened"], ["upload", "Dispute evidence", "Add evidence"], ["button", "Submit dispute", "Submit dispute"], ["alert", "Dispute status", "An administrator will review this case"]],
  Admin: [["title", "Admin title", "Operations control center"], ["card", "Admin users KPI", "Active users"], ["card", "Admin jobs KPI", "Jobs in progress"], ["card", "Admin revenue KPI", "Sandbox volume"], ["card", "Admin disputes KPI", "Open disputes"], ["input", "Admin search", "Search users, jobs, or disputes"], ["table", "Admin table", "Operations"], ["pagination", "Admin pagination", "Page navigation"], ["alert", "Unauthorized state", "You do not have permission to view this area"]],
  Reports: [["title", "Reports title", "Performance & insights"], ["card", "Report completion KPI", "Completion rate"], ["card", "Report rating KPI", "Customer rating"], ["card", "Report response KPI", "Response time"], ["chart", "Jobs chart", "Jobs completed"], ["chart", "Revenue chart", "Sandbox revenue"], ["select", "Report range", "Date range"]],
  Settings: [["text", "Settings introduction", "Manage appearance, notifications, privacy, offline data, and account access."], ["select", "Theme setting", "Theme"], ["checkbox", "Offline setting", "Keep data available offline"], ["checkbox", "Notification setting", "Local and push notifications"], ["checkbox", "Location setting", "Use location for nearby services"], ["button", "Create data backup", "Create backup"], ["button", "Sign out setting", "Sign out"]],
};

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 90, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
const right = page.locator(".right-panel");
const exactEnd = (value) => new RegExp(`${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");

async function selectPage(name) {
  await page.locator(".page-list button").filter({ hasText: name }).first().click();
  await page.waitForTimeout(180);
}

async function fillVisualLabel(label, value) {
  const field = right.locator("label").filter({ hasText: label }).first().locator("input,textarea").first();
  if (await field.count()) await field.fill(value);
}

async function add(type, name, label, parentName) {
  if (await page.locator(".layers button").filter({ hasText: name }).count()) return;
  const control = page.locator(".palette button").filter({ hasText: exactEnd(type) }).first();
  await control.click();
  await fillVisualLabel("Element name", name);
  await fillVisualLabel("Text or label", label);
  const parent = right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select");
  if (await parent.count()) await parent.selectOption({ label: parentName }).catch(() => undefined);
  const background = ["button"].includes(type) ? "#20C7C9" : ["card", "form", "list", "table", "map", "calendar", "chart", "gallery"].includes(type) ? "#171A1F" : "transparent";
  const foreground = type === "button" ? "#071012" : "#F3F4F6";
  const backgroundField = right.getByLabel("Background color value").first();
  const textField = right.getByLabel("Text color value").first();
  if (await backgroundField.count()) await backgroundField.fill(background);
  if (await textField.count()) await textField.fill(foreground);
  const corners = right.getByLabel("Quick corners");
  if (await corners.count()) await corners.fill(["title", "text", "link"].includes(type) ? "0" : "16");
  const animation = right.getByLabel("Animazione rapida");
  if (await animation.count()) await animation.selectOption({ label: "Rise" });
}

try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  for (const [pageName, components] of Object.entries(surfaces)) {
    await selectPage(pageName);
    const rootName = `${pageName} content`;
    const pageColor = right.getByLabel("Page color value");
    if (await pageColor.count()) await pageColor.fill("#0F1115");
    for (const [type, name, label] of components) await add(type, name, label, rootName);
  }
  await page.getByRole("button", { name: "mobile" }).click();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "13-mobile-surfaces.png"), fullPage: true });
  console.log(JSON.stringify({ pages: Object.keys(surfaces).length, activeLayers: await page.locator(".layers button").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-author-surfaces.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
