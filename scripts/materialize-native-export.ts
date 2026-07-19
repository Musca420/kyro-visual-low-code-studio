import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateFiles } from "../src/generator";
import { createProject } from "../src/model";

const project = createProject("Kyro Native Verification");
project.pages.push({ id: "home", name: "Home", path: "/", components: [] });
project.exportConfig = {
  target: "android",
  capacitor: true,
  android: { packageId: "studio.kyro.nativeverification", appName: "Kyro Native Verification", orientation: "any", themeColor: "#00b8c8", versionName: "1.0.0", versionCode: 1, permissions: [], statusBarStyle: "dark", keyboardResize: true, backButton: true },
};
project.extensionApprovals.push({ packageName: "@capacitor-community/bluetooth-le", version: "^8.0.0", reason: "Bluetooth Low Energy", approvedAt: new Date().toISOString() });
project.flows.push({ id: "native-check", name: "Native check", nodes: [
  { id: "load", type: "event", label: "Page opens", position: { x: 0, y: 0 }, config: { trigger: "pageLoad", pageId: "home" } },
  { id: "permission", type: "requestPermission", label: "Ask for camera", position: { x: 220, y: 0 }, config: { permission: "camera", rationale: "Take a profile photo" } },
  { id: "platform", type: "platformCondition", label: "Android 15+", position: { x: 440, y: 0 }, config: { platform: "android", minVersion: "15" } },
  { id: "photo", type: "nativeAction", label: "Take photo", position: { x: 660, y: 0 }, config: { capability: "camera", action: "takePhoto" } },
  { id: "bluetooth", type: "nativeAction", label: "Choose Bluetooth device", position: { x: 880, y: 0 }, config: { capability: "bluetooth", action: "requestDevice" } },
], edges: [
  { id: "one", source: "load", target: "permission", path: "success" },
  { id: "two", source: "permission", target: "platform", path: "success" },
  { id: "three", source: "platform", target: "photo", path: "success" },
  { id: "four", source: "photo", target: "bluetooth", path: "success" },
] });

const target = resolve("out", "native-verification");
await rm(target, { recursive: true, force: true });
for (const [path, contents] of Object.entries(generateFiles(project))) {
  const file = resolve(target, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}
console.log(target);
