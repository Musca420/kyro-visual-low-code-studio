# Registered native capabilities

- Camera/media: take photo, choose image; camera permission.
- Location: current position, open map; location permission.
- Bluetooth LE: choose, scan, connect, disconnect, read, write; scan/connect permissions; community extension approval.
- Device/system: platform, OS version, model and battery.
- Network: connection state.
- Haptics: impact and vibration.
- Share and clipboard: system share, copy and read.
- Files: write, read and delete in the app sandbox.
- Motion: orientation and motion events.
- Notifications: local scheduling; push registration requires provider setup and extension approval.

The registry is authoritative for platforms, minimum Android version, permissions, output type and exact package version. If an action is absent, use the capability resolver instead of inventing a success.
