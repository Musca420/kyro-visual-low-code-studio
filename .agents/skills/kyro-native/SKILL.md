---
name: kyro-native
description: Add and verify Android, iOS and web device capabilities in Kyro through permission, platform-condition and native-action nodes. Use for camera, location, Bluetooth, notifications, files, sensors, sharing, clipboard, haptics, network and device information.
---

# Kyro Native

1. Inspect the selected component and intended outcome with `$kyro-live-context`.
2. Read [references/capabilities.md](references/capabilities.md) and choose a registered capability/action.
3. Add a permission node when required and connect denied/error feedback.
4. Add a platform condition for platform- or OS-specific behavior; always provide a fallback branch.
5. Add the native action and bind its typed output to UI, state or data.
6. If the capability uses a community package, invoke `$kyro-extensions`; do not approve it silently.
7. Verify web preview honestly. A device-only action must report that a device is required, never simulate success.
8. Export and test the native build on a real device before claiming completion.
