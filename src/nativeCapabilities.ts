import type { FlowNode, Project } from "./model";
import { capabilityContractSchema, type CapabilityContract } from "./capabilityContract";
import { z } from "zod";

export type NativeActionDefinition = {
  id: string;
  label: string;
  description: string;
  output: "unknown" | "string" | "number" | "record" | "list";
  input: "unknown" | "string" | "number" | "record" | "list";
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  requires: string[];
  errors: string[];
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
  version: string;
  lifecycle: "active";
  effects: ("native" | "dependency")[];
  implementation: { kind: "native_adapter"; reference: string; version: string; status: "verified" };
};

type NativeCapabilitySource = Omit<NativeCapabilityDefinition, "version" | "lifecycle" | "effects" | "implementation" | "actions"> & { actions: (Omit<NativeActionDefinition, "input" | "inputSchema" | "outputSchema" | "requires" | "errors"> & Partial<Pick<NativeActionDefinition, "input" | "inputSchema" | "outputSchema" | "requires" | "errors">>)[] };
const defineNativeCapability = (source: NativeCapabilitySource): NativeCapabilityDefinition => ({
  ...source,
  version: "1.0.0",
  lifecycle: "active",
  effects: Object.keys(source.packages).length ? ["native", "dependency"] : ["native"],
  implementation: { kind: "native_adapter", reference: `runtime:native:${source.id}`, version: "1.0.0", status: "verified" },
  actions: source.actions.map((action) => ({ input: "unknown", inputSchema: z.unknown(), outputSchema: z.unknown(), requires: [], errors: [], ...action })),
});

const locationOutput = z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().nonnegative() });
const bleDevice = z.object({ deviceId: z.string().min(1) });
const bleCharacteristic = bleDevice.extend({ service: z.string().min(1), characteristic: z.string().min(1) });
const filePath = z.object({ path: z.string().min(1), directory: z.string().optional() });

const nativeCapabilitySources: NativeCapabilitySource[] = [
  { id: "camera", label: "Camera & media", description: "Take a photo or let the user choose media.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["camera"], packages: { "@capacitor/camera": "^8.0.0" }, externalApproval: false, actions: [
    { id: "takePhoto", label: "Take photo", description: "Open the system camera and return the captured image.", output: "record" },
    { id: "pickImage", label: "Choose image", description: "Open the system media picker.", output: "record" },
  ] },
  { id: "barcode", label: "QR & barcode scanner", description: "Scan QR codes and common product or inventory barcodes with the device camera.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["camera"], packages: { "@capacitor-mlkit/barcode-scanning": "^8.1.0" }, externalApproval: true, actions: [
    { id: "scanQr", label: "Scan QR code", description: "Open the native scanner and return the first QR code.", output: "record" },
    { id: "scanBarcode", label: "Scan barcode", description: "Open the native scanner and return the first supported barcode.", output: "record" },
  ] },
  { id: "location", label: "Location", description: "Read the current device location or watch movement.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["geolocation"], packages: { "@capacitor/geolocation": "^8.0.0" }, externalApproval: false, actions: [
    { id: "getCurrentPosition", label: "Get current position", description: "Return latitude, longitude and accuracy.", output: "record", inputSchema: z.object({ highAccuracy: z.boolean().optional() }), outputSchema: locationOutput, requires: ["permission.geolocation"], errors: ["permission_denied", "position_unavailable", "timeout"] },
    { id: "openMap", label: "Open map", description: "Open a map at the supplied coordinates.", output: "unknown", inputSchema: z.object({ latitude: z.number(), longitude: z.number(), label: z.string().optional() }), outputSchema: z.object({ opened: z.boolean() }), requires: ["system.map_handler"], errors: ["map_unavailable", "invalid_coordinates"] },
  ] },
  { id: "bluetooth", label: "Bluetooth Low Energy", description: "Scan, connect, read and write BLE devices.", platforms: ["web", "android", "ios"], minAndroid: 24, permissions: ["bluetoothScan", "bluetoothConnect", "geolocationLegacy"], packages: { "@capacitor-community/bluetooth-le": "^8.0.0" }, externalApproval: true, actions: [
    { id: "requestDevice", label: "Choose device", description: "Ask the user to choose a nearby BLE device.", output: "record", inputSchema: z.object({ services: z.array(z.string()).optional() }), outputSchema: z.object({ deviceId: z.string(), name: z.string().optional() }), requires: ["permission.bluetoothScan"], errors: ["permission_denied", "selection_cancelled", "bluetooth_unavailable"] },
    { id: "scan", label: "Scan devices", description: "Return nearby devices matching optional services.", output: "list", inputSchema: z.object({ services: z.array(z.string()).optional(), timeoutMs: z.number().int().positive().max(60_000).optional() }), outputSchema: z.array(z.object({ deviceId: z.string(), name: z.string().optional(), rssi: z.number().optional() })), requires: ["permission.bluetoothScan"], errors: ["permission_denied", "bluetooth_unavailable", "scan_failed"] },
    { id: "connect", label: "Connect", description: "Connect to the selected device.", output: "record", inputSchema: bleDevice, outputSchema: z.object({ connected: z.boolean() }), requires: ["permission.bluetoothConnect"], errors: ["permission_denied", "device_unavailable", "connection_failed"] },
    { id: "disconnect", label: "Disconnect", description: "Disconnect from a device.", output: "unknown", inputSchema: bleDevice, outputSchema: z.object({ disconnected: z.boolean() }), requires: ["bluetooth.connected"], errors: ["device_disconnected"] },
    { id: "read", label: "Read characteristic", description: "Read a BLE characteristic.", output: "record", inputSchema: bleCharacteristic, outputSchema: z.object({ value: z.string() }), requires: ["bluetooth.connected"], errors: ["permission_denied", "device_disconnected", "read_failed"] },
    { id: "write", label: "Write characteristic", description: "Write a value to a BLE characteristic.", output: "unknown", inputSchema: bleCharacteristic.extend({ value: z.string() }), outputSchema: z.object({ written: z.boolean() }), requires: ["bluetooth.connected"], errors: ["permission_denied", "device_disconnected", "write_failed"] },
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
    { id: "write", label: "Copy value", description: "Copy text to the clipboard.", output: "unknown", inputSchema: z.object({ value: z.string() }), outputSchema: z.object({ written: z.boolean() }), errors: ["permission_denied", "write_failed"] },
    { id: "read", label: "Read value", description: "Read clipboard content where the platform allows it.", output: "record", inputSchema: z.object({}), outputSchema: z.object({ value: z.string() }), errors: ["permission_denied", "read_failed"] },
  ] },
  { id: "files", label: "Files", description: "Store and retrieve files in the app sandbox.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/filesystem": "^8.0.0" }, externalApproval: false, actions: [
    { id: "writeFile", label: "Save file", description: "Write a file in the app sandbox.", output: "record", inputSchema: filePath.extend({ data: z.string(), encoding: z.enum(["utf8", "base64"]).optional() }), outputSchema: z.object({ uri: z.string() }), errors: ["invalid_path", "permission_denied", "write_failed"] },
    { id: "readFile", label: "Read file", description: "Read a stored file.", output: "record", inputSchema: filePath, outputSchema: z.object({ data: z.string() }), errors: ["not_found", "permission_denied", "read_failed"] },
    { id: "deleteFile", label: "Delete file", description: "Delete a stored file.", output: "unknown", inputSchema: filePath, outputSchema: z.object({ deleted: z.boolean() }), errors: ["not_found", "permission_denied", "delete_failed"] },
  ] },
  { id: "motion", label: "Motion sensors", description: "Read accelerometer and orientation events.", platforms: ["web", "android", "ios"], permissions: [], packages: { "@capacitor/motion": "^8.0.0" }, externalApproval: false, actions: [
    { id: "getOrientation", label: "Get orientation", description: "Return the most recent device orientation.", output: "record" },
  ] },
  { id: "push", label: "Push notifications", description: "Register this device and receive remote notifications.", platforms: ["web", "android", "ios"], permissions: ["notifications"], packages: { "@capacitor/push-notifications": "^8.0.0" }, externalApproval: true, actions: [
    { id: "register", label: "Register for push", description: "Request permission and return a device token through the provider flow.", output: "record", inputSchema: z.object({ provider: z.string().optional() }), outputSchema: z.object({ token: z.string().min(1) }), requires: ["permission.notifications", "push.provider_configured"], errors: ["permission_denied", "provider_missing", "registration_failed"] },
  ] },
];

export const nativeCapabilities: NativeCapabilityDefinition[] = nativeCapabilitySources.map(defineNativeCapability);

export const nativeCapabilityContracts: CapabilityContract[] = nativeCapabilities.map((capability) => capabilityContractSchema.parse({
  schemaVersion: 1,
  capabilityId: `native.${capability.id}`,
  name: capability.label,
  version: capability.version,
  inputs: [{ name: "action input", type: "unknown", required: false }],
  outputs: [{ name: "action output", type: "unknown", required: false }],
  effects: capability.effects,
  permissions: capability.permissions,
  dependencies: Object.entries(capability.packages).map(([name, version]) => ({ name, version, approvalRequired: capability.externalApproval })),
  platforms: capability.platforms,
  implementation: capability.implementation,
}));

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
  const requested = new Map<string, { packageName: string; version: string; capabilityId: string; capabilityLabel: string; permissions: string[]; platforms: NativeCapabilityDefinition["platforms"]; license: string; risk: "medium" | "high"; rollback: string; approved: boolean }>();
  for (const node of nativeNodes(project)) {
    const capability = nativeCapability(node.config.capability);
    if (!capability?.externalApproval) continue;
    for (const [packageName, version] of Object.entries(capability.packages)) requested.set(packageName, {
      packageName, version, capabilityId: capability.id, capabilityLabel: capability.label, permissions: capability.permissions, platforms: capability.platforms,
      license: "MIT", risk: capability.permissions.length ? "high" : "medium", rollback: "Revoke approval and rebuild the export without this device capability",
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
  const web = navigator as unknown as {
    geolocation: { getCurrentPosition: (success: (position: { coords: { latitude: number; longitude: number; accuracy: number } }) => void, error: (reason: unknown) => void, options: { enableHighAccuracy: boolean; timeout: number }) => void };
    clipboard: { writeText: (text: string) => Promise<void>; readText: () => Promise<string> };
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>; vibrate?: (duration: number) => boolean;
    userAgent: string; platform: string; onLine: boolean; getBattery?: () => Promise<{ level: number; charging: boolean }>;
    connection?: { effectiveType?: string }; bluetooth?: { requestDevice: (options: unknown) => Promise<{ id: string; name?: string }> };
  };
  if (capability === "location" && action === "getCurrentPosition") return new Promise((resolve, reject) => web.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }), reject, { enableHighAccuracy: config.highAccuracy === "true", timeout: 10_000 }));
  if (capability === "clipboard" && action === "write") { await web.clipboard.writeText(String(config.value || value || "")); return value; }
  if (capability === "clipboard" && action === "read") return { value: await web.clipboard.readText() };
  if (capability === "share" && action === "share") { if (!web.share) throw new Error("System sharing is not available in this preview."); await web.share({ title: config.title, text: config.text || String(value || ""), url: config.url || undefined }); return { completed: true }; }
  if (capability === "haptics") { web.vibrate?.(action === "vibrate" ? Math.min(1000, Math.max(20, Number(config.duration) || 100)) : 40); return value; }
  if (capability === "device" && action === "getInfo") return { platform: "web", osVersion: web.userAgent, model: web.platform, isVirtual: false };
  if (capability === "device" && action === "getBattery") { const battery = await web.getBattery?.(); return battery ? { level: battery.level, charging: battery.charging } : { level: undefined, charging: undefined }; }
  if (capability === "network" && action === "getStatus") return { connected: web.onLine, connectionType: web.connection?.effectiveType ?? "unknown" };
  if (capability === "bluetooth" && action === "requestDevice") { const bluetooth = web.bluetooth; if (!bluetooth) throw new Error("Web Bluetooth is not available here. Test this flow on a supported browser or Android build."); const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: (config.services || "").split(",").filter(Boolean) }); return { id: device.id, name: device.name }; }
  throw new Error(`${nativeCapability(capability)?.label ?? "This capability"} needs a real device for ${nativeAction(capability, action)?.label ?? action}. Kyro did not simulate a success.`);
}
