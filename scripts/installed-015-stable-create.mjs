import { chromium } from "playwright";

let browser;
for (let attempt = 0; attempt < 40 && !browser; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  browser = await chromium.connectOverCDP("http://127.0.0.1:9333").catch(() => undefined);
}
if (!browser) throw new Error("Frontend Editor 0.1.5 non raggiungibile");
const page = browser.contexts()[0].pages()[0];
const pause = (ms = 1500) => page.waitForTimeout(ms);
await page.bringToFront();
await pause(2200);

console.log("Creo Orbit Studio Stable dal template visuale");
await page.getByLabel("Nome progetto").fill("Orbit Studio Stable");
await pause();
await page.getByRole("button", { name: "Landing page Hero, feature, CTA e footer" }).click();
await pause(2200);
await page.getByRole("button", { name: "Tutorial completo" }).click();
await pause(2600);
await page.getByRole("button", { name: "Inizia dal canvas" }).click();

console.log("Personalizzo hero, palette, font e animazione dal pannello Design");
await page.getByRole("button", { name: /Hero title/ }).click();
const inspector = page.locator(".right-panel");
await inspector.getByLabel("Testo o etichetta").fill("Design che trasforma idee in prodotti memorabili.");
await inspector.getByRole("button", { name: "Palette Corallo" }).click();
await inspector.getByLabel("Font rapido").selectOption({ label: "Editoriale" });
await inspector.getByLabel("Peso rapido").selectOption({ label: "Forte" });
await inspector.getByLabel("Angoli rapido").fill("28");
await inspector.getByLabel("Ombra rapida").selectOption({ label: "Media" });
await inspector.getByLabel("Animazione rapida").selectOption({ label: "Salita" });
await pause();
await page.screenshot({ path: "artifacts/installed-015-stable-design.png" });

console.log("Creo la sorgente locale dal pannello Dati");
await page.getByRole("button", { name: "Dati" }).click();
await page.getByLabel("Nome", { exact: true }).fill("Richieste contatto Orbit");
await page.getByLabel("Collezione", { exact: true }).fill("contacts");
await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
await pause(2200);

console.log("Creo i flow visuali per navigazione, notifica e contatto");
await page.getByRole("button", { name: "Flow" }).click();
await page.getByRole("button", { name: "Crea interazioni landing" }).click();
await pause(2200);
await page.getByLabel("Flow attivo").selectOption({ label: "Demo interattiva" });
await page.screenshot({ path: "artifacts/installed-015-stable-flow.png" });

console.log("Uso la pagina in preview come visitatore");
await page.getByRole("button", { name: "Preview" }).click();
const preview = page.frameLocator('iframe[title="Preview isolata"]');
await pause(2200);
await preview.getByRole("button", { name: "Explore features" }).click();
await pause();
await preview.getByRole("button", { name: "See how it works" }).click();
await pause();
await page.getByRole("button", { name: "mobile" }).click();
await pause(2200);
await page.screenshot({ path: "artifacts/installed-015-stable-mobile.png" });
await page.getByRole("button", { name: "Design" }).click();
await pause(2200);
await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
await pause(2200);
await page.screenshot({ path: "artifacts/installed-015-stable-home.png" });
console.log("Creazione stabile completata; ora l'app può essere riavviata");
