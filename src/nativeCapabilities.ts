import type { FlowNode, Project } from "./model";

export type NativeActionDefinition = {
  id: string;
  label: string;
  description: string;
  output: "unknown" | "string" | "number" | "record" | "list";
};

export type NativeCapabilityDefinition = {
  id: string;
  label: string;
  description: string;
  platforms: ("web" | "android" | "ios")[];
  minAndroid?: number;
  permissions: string[];
  packages: Record<string, string>;
  externalApproval: boolean;
  actions: NativeActionDefinition[];
};

export const nativeCapabilities: NativeCapabilityDefinition[] = [
  { id: "camera", label: "Camera & media", description: "Take a photo or let the user choose media.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["camera"], packages: { "@capacitor/camera": "^8.0.0" }, externalApproval: false, actions: [
    { id: "takePhoto", label: "Take photo", description: "Open the system camera and return the captured image.", output: "record" },
    { id: "pickImage", label: "Choose image", description: "Open the system media picker.", output: "record" },
  ] },
  { id: "location", label: "Location", description: "Read the current device location or watch movement.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["geolocation"], packages: { "@capacitor/geolocation": "^8.0.0" }, externalApproval: false, actions: [
    { id: "getCurrentPosition", label: "Get current position", description: "Return latitude, longitude and accuracy.", output: "record" },
    { id: "openMap", label: "Open map", description: "Open a map at the supplied coordinates.", output: "unknown" },
  ] },
  { id: "bluetooth", label: "Bluetooth Low Energy", description: "Scan, connect, read and write BLE devices.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["bluetoothScan", "bluetoothConnect", "geolocationLegacy"], packages: { "@capacitor-community/bluetooth-le": "^8.0.0" }, externalApproval: true, actions: [
    { id: "requestDevice", label: "Choose device", description: "Ask the user to choose a nearby BLE device.", output: "record" },
    { id: "scan", label: "Scan devices", description: "Return nearby devices matching optional services.", output: "list" },
    { id: "connect", label: "Connect", description: "Connect to the selected device.", output: "record" },
    { id: "disconnect", label: "Disconnect", description: "Disconnect from a device.", output: "unknown" },
    { id: "read", label: "Read characteristic", description: "Read a BLE characteristic.", output: "record" },
    { id: "write", label: "Write characteristic", description: "Write a value to a BLE characteristic.", output: "unknown" },
  ] },
  { id: "device", label: "Device & system", description: "Read platform, operating-system version and device information.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: [], packages: { "@capacitor/device": "^8.0.0" }, externalApproval: false, actions: [
    { id: "getInfo", label: "Get device info", description: "Return platform, OS version, model and virtual-device state.", output: "record" },
    { id: "getBattery", label: "Get battery info", description: "Return battery level and charging state when available.", output: "record" },
  ] },
  { id: "network", label: "Network", description: "Read connection state and react to connectivity changes.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/network": "^8.0.0" }, externalApproval: false, actions: [
    { id: "getStatus", label: "Get connection status", description: "Return whether the device is connected and the connection type.", output: "record" },
  ] },
  { id: "haptics", label: "Haptics", description: "Provide tactile feedback for important interactions.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/haptics": "^8.0.0" }, externalApproval: false, actions: [
    { id: "impact", label: "Impact feedback", description: "Play light, medium or heavy tactile feedback.", output: "unknown" },
    { id: "vibrate", label: "Vibrate", description: "Vibrate for a short duration.", output: "unknown" },
  ] },
  { id: "share", label: "System share", description: "Open the native share sheet.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/share": "^8.0.0" }, externalApproval: false, actions: [
    { id: "share", label: "Share content", description: "Share text, a URL or supported files.", output: "record" },
  ] },
  { id: "clipboard", label: "Clipboard", description: "Read or write clipboard content with user intent.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/clipboard": "^8.0.0" }, externalApproval: false, actions: [
    { id: "write", label: "Copy value", description: "Copy text to the clipboard.", output: "unknown" },
    { id: "read", label: "Read value", description: "Read clipboard content where the platform allows it.", output: "record" },
  ] },
  { id: "files", label: "Files", description: "Store and retrieve files in the app sandbox.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/filesystem": "^8.0.0" }, externalApproval: false, actions: [
    { id: "writeFile", label: "Save file", description: "Write a file in the app sandbox.", output: "record" },
    { id: "readFile", label: "Read file", description: "Read a stored file.", output: "record" },
    { id: "deleteFile", label: "Delete file", description: "Delete a stored file.", output: "unknown" },
  ] },
  { id: "motion", label: "Motion sensors", description: "Read accelerometer and orientation events.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/motion": "^8.0.0" }, externalApproval: false, actions: [
    { id: "getOrientation", label: "Get orientation", description: "Return the most recent device orientation.", output: "record" },
  ] },
  { id: "push", label: "Push notifications", description: "Register this device and receive remote notifications.", platforms: ["web", "android", "ios"], permissions: ["notifications"], packages: { "@capacitor/push-notifications": "^8.0.0" }, externalApproval: true, actions: [
    { id: "register", label: "Register for push", description: "Request permission and return a device token through the provider flow.", output: "record" },
  ] },
];

export function nativeCapability(id = "") {
  return nativeCapabilities.find((capability) => capability.id === id);
}

export function nativeAction(capabilityId = "", actionId = "") {
  return nativeCapability(capabilityId)?.actions.find((action) => action.id === actionId);
}

export function nativeNodes(project: Project) {
  return project.flows.flatMap((flow) => flow.nodes.filter((node) => node.type === "nativeAction"));
}

export function nativePackagesForProject(project: Project) {
  return Object.assign({}, ...nativeNodes(project).map((node) => {
    const capability = nativeCapability(node.config.capability);
    if (!capability || (capability.externalApproval && !Object.entries(capability.packages).every(([packageName, version]) => project.extensionApprovals.some((approval) => approval.packageName === packageName && approval.version === version)))) return {};
    return capability.packages;
  })) as Record<string, string>;
}

export function nativeExtensionRequests(project: Project) {
  const requested = new Map<string, { packageName: string; version: string; capabilityId: string; capabilityLabel: string; permissions: string[]; approved: boolean }>();
  for (const node of nativeNodes(project)) {
    const capability = nativeCapability(node.config.capability);
    if (!capability?.externalApproval) continue;
    for (const [packageName, version] of Object.entries(capability.packages)) requested.set(packageName, {
      packageName, version, capabilityId: capability.id, capabilityLabel: capability.label, permissions: capability.permissions,
      approved: project.extensionApprovals.some((approval) => approval.packageName === packageName && approval.version === version),
    });
  }
  return [...requested.values()];
}

export function nativePermissionsForProject(project: Project) {
  return [...new Set(nativeNodes(project).flatMap((node) => nativeCapability(node.config.capability)?.permissions ?? []))];
}

export function nativeNodeIssue(node: FlowNode) {
  if (node.type !== "nativeAction") return undefined;
  const capability = nativeCapability(node.config.capability);
  if (!capability) return "Choose a native capability.";
  if (!nativeAction(capability.id, node.config.action)) return `Choose an action for ${capability.label}.`;
  return undefined;
}

export async function runNativeWeb(capability: string, action: string, value: unknown, config: Record<string, string>) {
  if (capability === "location" && action === "getCurrentPosition") return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }), reject, { enableHighAccuracy: config.highAccuracy === "true", timeout: 10_000 }));
  if (capability === "clipboard" && action === "write") { await navigator.clipboard.writeText(String(config.value || value || "")); return value; }
  if (capability === "clipboard" && action === "read") return { value: await navigator.clipboard.readText() };
  if (capability === "share" && action === "share") { if (!navigator.share) throw new Error("System sharing is not available in this preview."); await navigator.share({ title: config.title, text: config.text || String(value || ""), url: config.url || undefined }); return { completed: true }; }
  if (capability === "haptics") { navigator.vibrate?.(action === "vibrate" ? Math.min(1000, Math.max(20, Number(config.duration) || 100)) : 40); return value; }
  if (capability === "device" && action === "getInfo") return { platform: "web", osVersion: navigator.userAgent, model: navigator.platform, isVirtual: false };
  if (capability === "device" && action === "getBattery") { const battery = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery?.(); return battery ? { level: battery.level, charging: battery.charging } : { level: undefined, charging: undefined }; }
  if (capability === "network" && action === "getStatus") return { connected: navigator.onLine, connectionType: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "unknown" };
  if (capability === "bluetooth" && action === "requestDevice") { const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice: (options: unknown) => Promise<{ id: string; name?: string }> } }).bluetooth; if (!bluetooth) throw new Error("Web Bluetooth is not available here. Test this flow on a supported browser or Android build."); const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: (config.services || "").split(",").filter(Boolean) }); return { id: device.id, name: device.name }; }
  throw new Error(`${nativeCapability(capability)?.label ?? "This capability"} needs a real device for ${nativeAction(capability, action)?.label ?? action}. Kyro did not simulate a success.`);
}
