import type { Project } from "../model";
import { nativePackagesForProject } from "../nativeCapabilities";

export const usesNativeRuntime = (project: Project) => project.flows.some((flow) => flow.nodes.some((node) => ["requestPermission", "nativeAction", "platformCondition"].includes(node.type)));

export function withNativeCapabilities(project: Project, files: Record<string, string>) {
  if (!usesNativeRuntime(project)) return files;
  const requested = new Set(project.flows.flatMap((flow) => flow.nodes.filter((node) => node.type === "requestPermission").map((node) => node.config.permission)));
  const packages: Record<string, string> = { "@capacitor/core": "^8.0.0", ...nativePackagesForProject(project) };
  if (project.flows.some((flow) => flow.nodes.some((node) => node.type === "platformCondition"))) packages["@capacitor/device"] = "^8.0.0";
  if (requested.has("camera")) packages["@capacitor/camera"] = "^8.0.0";
  if (requested.has("geolocation")) packages["@capacitor/geolocation"] = "^8.0.0";
  if (requested.has("notifications")) packages["@capacitor/local-notifications"] = "^8.0.0";
  const pkg = JSON.parse(files["package.json"]) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...pkg.dependencies, ...packages };
  files["package.json"] = JSON.stringify(pkg, null, 2);
  const has = (name: string) => Boolean(packages[name]);
  const imports = [
    "import { Capacitor } from '@capacitor/core'",
    has("@capacitor/camera") ? "import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'" : "",
    has("@capacitor/geolocation") ? "import { Geolocation } from '@capacitor/geolocation'" : "",
    has("@capacitor/device") ? "import { Device } from '@capacitor/device'" : "",
    has("@capacitor/network") ? "import { Network } from '@capacitor/network'" : "",
    has("@capacitor/haptics") ? "import { Haptics, ImpactStyle } from '@capacitor/haptics'" : "",
    has("@capacitor/share") ? "import { Share } from '@capacitor/share'" : "",
    has("@capacitor/clipboard") ? "import { Clipboard } from '@capacitor/clipboard'" : "",
    has("@capacitor/filesystem") ? "import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'" : "",
    has("@capacitor/motion") ? "import { Motion } from '@capacitor/motion'" : "",
    has("@capacitor/local-notifications") ? "import { LocalNotifications } from '@capacitor/local-notifications'" : "",
    has("@capacitor/push-notifications") ? "import { PushNotifications } from '@capacitor/push-notifications'" : "",
    has("@capacitor-community/bluetooth-le") ? "import { BleClient } from '@capacitor-community/bluetooth-le'" : "",
    has("@capacitor-mlkit/barcode-scanning") ? "import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning'" : "",
  ].filter(Boolean).join("\n");
  files["src/native.ts"] = `${imports}
type Options = Record<string, string>
const parseOptions = (text = ''): Options => Object.fromEntries(text.split(/\\r?\\n|,/).map((line) => line.split('=')).filter((pair) => pair.length > 1).map(([key, ...rest]) => [key.trim(), rest.join('=').trim()]))
const webInfo = () => ({ platform: 'web', version: navigator.userAgent })
export async function getPlatformInfo() { ${has("@capacitor/device") ? "if (Capacitor.isNativePlatform()) { const info = await Device.getInfo(); return { platform: info.platform, version: info.osVersion } }" : ""} return webInfo() }
export async function requestNativePermission(permission: string, _rationale = '') { if (!Capacitor.isNativePlatform()) { if (permission === 'notifications' && 'Notification' in window) return (Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission) === 'granted'; if (permission === 'geolocation' && navigator.permissions) return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; return false }
  ${has("@capacitor/camera") ? "if (permission === 'camera') return (await Camera.requestPermissions({ permissions: ['camera', 'photos'] })).camera === 'granted'" : ""}
  ${has("@capacitor-mlkit/barcode-scanning") ? "if (permission === 'camera') return (await BarcodeScanner.requestPermissions()).camera === 'granted'" : ""}
  ${has("@capacitor/geolocation") ? "if (permission === 'geolocation') return (await Geolocation.requestPermissions()).location === 'granted'" : ""}
  ${has("@capacitor/local-notifications") ? "if (permission === 'notifications') return (await LocalNotifications.requestPermissions()).display === 'granted'" : ""}
  return false }
export async function runNativeAction(capability: string, action: string, value: unknown, raw: Options) { const options = { ...raw, ...parseOptions(raw.options) }
  ${has("@capacitor/camera") ? "if (capability === 'camera') { const photo = await Camera.getPhoto({ resultType: CameraResultType.Uri, source: action === 'takePhoto' ? CameraSource.Camera : CameraSource.Photos, quality: Math.min(100, Math.max(1, Number(options.quality) || 85)) }); return { path: photo.path, webPath: photo.webPath, format: photo.format, saved: photo.saved } }" : ""}
  ${has("@capacitor/geolocation") ? "if (capability === 'location' && action === 'getCurrentPosition') { const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: options.highAccuracy === 'true', timeout: 10000 }); return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } }" : ""}
  ${has("@capacitor/device") ? "if (capability === 'device' && action === 'getInfo') return Device.getInfo(); if (capability === 'device' && action === 'getBattery') return Device.getBatteryInfo()" : ""}
  ${has("@capacitor/network") ? "if (capability === 'network' && action === 'getStatus') return Network.getStatus()" : ""}
  ${has("@capacitor/haptics") ? "if (capability === 'haptics') { if (action === 'vibrate') await Haptics.vibrate({ duration: Math.min(1000, Math.max(20, Number(options.duration) || 100)) }); else await Haptics.impact({ style: options.style === 'heavy' ? ImpactStyle.Heavy : options.style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }); return value }" : ""}
  ${has("@capacitor/share") ? "if (capability === 'share' && action === 'share') return Share.share({ title: options.title, text: options.text || String(value || ''), url: options.url || undefined })" : ""}
  ${has("@capacitor/clipboard") ? "if (capability === 'clipboard' && action === 'write') { await Clipboard.write({ string: options.value || String(value || '') }); return value } if (capability === 'clipboard' && action === 'read') return Clipboard.read()" : ""}
  ${has("@capacitor/filesystem") ? "if (capability === 'files' && action === 'writeFile') return Filesystem.writeFile({ path: options.path || 'file.txt', data: options.data || String(value || ''), directory: Directory.Data, encoding: Encoding.UTF8 }); if (capability === 'files' && action === 'readFile') return Filesystem.readFile({ path: options.path || 'file.txt', directory: Directory.Data, encoding: Encoding.UTF8 }); if (capability === 'files' && action === 'deleteFile') return Filesystem.deleteFile({ path: options.path || 'file.txt', directory: Directory.Data })" : ""}
  ${has("@capacitor/push-notifications") ? "if (capability === 'push' && action === 'register') { const permission = await PushNotifications.requestPermissions(); if (permission.receive !== 'granted') throw new Error('Push notification permission was denied'); await PushNotifications.register(); return { registered: true } }" : ""}
  ${has("@capacitor-community/bluetooth-le") ? "if (capability === 'bluetooth') { await BleClient.initialize(); if (action === 'requestDevice') return BleClient.requestDevice({ optionalServices: (options.services || '').split(',').filter(Boolean) }); if (action === 'scan') { const devices: unknown[] = []; await BleClient.requestLEScan({}, (result) => devices.push(result)); await new Promise((resolve) => setTimeout(resolve, Math.min(10000, Number(options.duration) || 3000))); await BleClient.stopLEScan(); return devices } if (action === 'connect') return BleClient.connect(String(options.deviceId || (value as { deviceId?: string })?.deviceId || '')); if (action === 'disconnect') return BleClient.disconnect(String(options.deviceId || (value as { deviceId?: string })?.deviceId || '')) }" : ""}
  ${has("@capacitor-mlkit/barcode-scanning") ? "if (capability === 'barcode') { const result = await BarcodeScanner.scan(action === 'scanQr' ? { formats: [BarcodeFormat.QrCode], autoZoom: true } : { autoZoom: true }); const barcode = result.barcodes[0]; if (!barcode) throw new Error('No QR code or barcode was detected'); return barcode }" : ""}
  if (capability === 'location' && action === 'openMap') { const input = value as { latitude?: number; longitude?: number }; location.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(String(options.latitude || input?.latitude || '') + ',' + String(options.longitude || input?.longitude || '')); return value }
  throw new Error('This device action is not available in the current target: ' + capability + '.' + action)
}
`;
  if (has("@capacitor-mlkit/barcode-scanning")) files["scripts/configure-android.mjs"] += `
manifest = await readFile(manifestPath, 'utf8')
const barcodeMetadata = '<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />'
if (!manifest.includes(barcodeMetadata)) manifest = manifest.replace('</application>', '    ' + barcodeMetadata + '\\n    </application>')
await writeFile(manifestPath, manifest)
`;
  return files;
}
