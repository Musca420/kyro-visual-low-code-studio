import { describe, expect, it } from "vitest";
import { createProject } from "../src/model";
import { nativeCapability, nativeExtensionRequests, nativeNodeIssue, nativePackagesForProject, nativePermissionsForProject } from "../src/nativeCapabilities";

describe("native capability registry", () => {
  it("derives packages and Android permissions from generic graph nodes", () => {
    const project = createProject("Device app");
    project.flows.push({ id: "capture", name: "Capture", nodes: [
      { id: "event", type: "event", label: "Tap", position: { x: 0, y: 0 }, config: { trigger: "click" } },
      { id: "camera", type: "nativeAction", label: "Photo", position: { x: 1, y: 0 }, config: { capability: "camera", action: "takePhoto" } },
      { id: "ble", type: "nativeAction", label: "BLE", position: { x: 2, y: 0 }, config: { capability: "bluetooth", action: "scan" } },
    ], edges: [] });
    expect(nativePackagesForProject(project)).not.toHaveProperty("@capacitor-community/bluetooth-le");
    expect(nativeExtensionRequests(project)).toContainEqual(expect.objectContaining({ packageName: "@capacitor-community/bluetooth-le", approved: false }));
    project.extensionApprovals.push({ packageName: "@capacitor-community/bluetooth-le", version: "^8.0.0", reason: "Bluetooth Low Energy", approvedAt: new Date().toISOString() });
    expect(nativePackagesForProject(project)).toMatchObject({ "@capacitor/camera": "^8.0.0", "@capacitor-community/bluetooth-le": "^8.0.0" });
    expect(nativePermissionsForProject(project)).toEqual(expect.arrayContaining(["camera", "bluetoothScan", "bluetoothConnect"]));
  });

  it("keeps platform support and approval requirements explicit", () => {
    expect(nativeCapability("bluetooth")?.externalApproval).toBe(true);
    expect(nativeCapability("camera")?.minAndroid).toBe(24);
    expect(nativeNodeIssue({ id: "x", type: "nativeAction", label: "Native", position: { x: 0, y: 0 }, config: {} })).toContain("Choose");
  });
});
