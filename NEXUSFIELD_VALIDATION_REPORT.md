# NexusField final validation report

Date: 20 July 2026. Environment: local Windows host, headed Chromium/Playwright, physical Android device, generated local REST backend. No private server was accessed.

## Deliverables

| Deliverable | Result |
| --- | --- |
| NexusField Web | 17-page responsive/PWA project created and configured through Kyro UI |
| NexusField Mobile | Separate Android project created and configured through Kyro UI |
| Web export | ZIP generated through Publish, installed, built, and run independently |
| Android export | Capacitor project generated through Publish, APK built and installed with `adb install -r` |
| Shared data | Web and Android protected flows created records in the same generated local backend |
| Visual evidence | Headed recordings, screenshots 01–113, final/offline Playwright traces, and narrated MP4 |

## Mobile/Web parity

| Capability | Web/PWA | Android |
| --- | --- | --- |
| Registration/login and roles | Generated auth, role guards, admin/manager allowed and viewer denied | Same backend/auth; session survives force-stop after generator fix |
| Search/filter/navigation | Responsive forms, filters, routes, sidebar/navigation | Search screen, filters, five-tab bottom navigation, Android back |
| Quote/booking/payment | Visual pages and protected sandbox payment flow | Equivalent pages and sandbox payment action |
| Assignment/team | Assigned-team action writes a shared protected record | Urgent-job action writes the same shared backend and shows success toast |
| Chat/realtime | Messages/chat surfaces and SSE configuration | Equivalent routes; local backend SSE shared with Web |
| Completion/signature/review | Completion, signature, invoice/review surfaces and flows | Touch signature and completion flow; camera evidence capture |
| Dispute/refund/admin | Dispute, admin, guarded refund/payment nodes | Equivalent routes and role-aware flows |
| Data states | Loading, empty, error, list/table, KPI and binding states | Loading, empty, error, list/card and binding states |
| Offline | Installable PWA service worker; an offline protected mutation queues, synchronizes on reconnect, and persists after reload | Bundled UI stays available; an offline protected mutation queues on-device and synchronizes to the shared backend after reconnect |
| Native | Web fallbacks/capability explanations | Camera, geolocation, QR/barcode extension, local notifications, deep link, safe area, keyboard resize |

## Final browser path

1. Open Kyro at `http://127.0.0.1:43127` in headed Chromium.
2. Open and repeatedly reopen NexusField Web and NexusField Mobile from Recent projects.
3. Use Design, Data, Flow, Preview, Codex, and Publish panels through accessible labels and visible clicks.
4. Export NexusField Web as PWA ZIP; install dependencies, build, and run on `127.0.0.1:43230`.
5. Register/login, run the protected sandbox payment and assigned-team shared-data flows, refresh, tab through navigation, resize to desktop/tablet/mobile, then reload offline.
6. Prepare Android from Publish, build the APK, install with `-r`, and use the physical device as a user.

Final Web result: login passed; protected mutation passed; shared backend mutation passed; session persisted after refresh; keyboard focus landed on the Dashboard link; offline title remained `NexusField Web`; zero blocking console errors. The dedicated offline verifier recorded backend count `0 -> 1`, queue length `1 -> 0`, and the synchronized record still present after reload.

## Final Android path

1. Install/update `studio.kyro.nexusfieldmobile` with `adb install -r`.
2. Register the first account through the APK, then navigate Home → Tasks.
3. Tap the visual “08:30 · Heating repair” card whose semantic graph ID is Urgent job.
4. Observe “Urgent job completed” and verify the generated backend record count increases.
5. Press Android Back and verify Tasks → Home.
6. Force-stop/relaunch and verify the authenticated Home opens directly and data remains.
7. Stop the local backend, cold-start the APK, verify the bundled UI/fallback states remain and no crash occurs; restart backend and verify clean recovery.
8. Trigger Complete job, grant camera permission, and observe the system camera.
9. Trigger Use my current location, grant precise foreground location, and verify the native Geolocation callback in the device log.
10. Enable notifications and schedule Add appointment; observe “Reminder scheduled” and the real Android “Appointment reminder” notification.
11. Disable Wi-Fi and mobile data, tap the visible Urgent job action, verify one queued mutation, reconnect, then verify queue drain and shared backend count `1 -> 2`.

Final Android result: cold launch about 1.5 seconds; zero matched fatal/runtime errors after recovery; camera, location, local notification, keyboard resize, back navigation, auth persistence, offline queue/replay, and shared backend mutation verified on physical hardware. The release APK was updated in place with `adb install -r`; `106-android-offline-mutation-queued.png`, `107-android-offline-mutation-synced.png`, `108-android-offline-sync-final.png`, and `113-android-five-tab-final.png` record the offline transaction, authenticated force-stop/relaunch, safe area, and final five-tab navigation.

## Unified graph evidence

The final projects remain editable visual graphs rather than handwritten demo applications. NexusField Web contains 17 pages, 187 components, 14 flows, 68 nodes, 16 sources, 26 bindings, and 11 event-bearing components at revision 1336. NexusField Mobile contains 19 pages, 178 components, 20 flows, 93 nodes, 16 sources, 27 bindings, 14 event-bearing components, and 9 native nodes at revision 1394. Product runtime and generator source contain no NexusField-specific branch.

## Responsive and accessibility evidence

- Web export screenshots: `55-final-web-export-desktop.png`, `56-final-web-export-tablet.png`, `57-final-web-export-mobile.png`, `58-final-web-export-offline.png`.
- Offline synchronization: `103-web-offline-mutation-synced.png`, `106-android-offline-mutation-queued.png`, `107-android-offline-mutation-synced.png`, and `108-android-offline-sync-final.png`.
- Android keyboard resize: `67-android-keyboard-resize.png`.
- Android back/persistence: `77-android-back-home.png`, `80-android-session-persisted.png`.
- Keyboard navigation in the Web export moved focus to an accessible page link.
- Generated controls retain labels, focus-visible outlines, minimum touch sizes, safe-area padding, semantic status/alert roles, and responsive navigation.

## Native evidence

- `85-android-camera-permission.png` and `86-android-camera-open.png`.
- `88-android-notification-permission.png`, `91-android-local-notification-toast.png`, and `92-android-local-notification.png`.
- `94-android-location-permission.png` and a successful native Geolocation callback (coordinates intentionally not recorded in the report).

## Bugs found and reusable fixes

| Defect reproduced | General fix | Regression proof |
| --- | --- | --- |
| Custom roles exported but could not mutate | Generated backend permits configured non-viewer roles; delete remains admin-only | Generic generator/backend tests |
| Independent export port failed CORS | URL-parser CORS policy accepts only loopback HTTP/HTTPS origins on any port or one configured origin | Generic backend generator test and final export |
| Android could not reach explicit local HTTP backend | Android manifest enables cleartext only when a loopback HTTP endpoint is configured; README warns to use HTTPS in production | New non-NexusField generator test plus physical APK |
| Capacitor `https://localhost` rejected by backend | Loopback CORS accepts secure Capacitor localhost origin | Physical login and shared mutation |
| Auth disappeared after Android force-stop | Generated auth uses expiring-token local storage and logout removes it | Generic generator assertion and physical cold restart |
| Export script could publish the wrong active project | Visual export automation returns to Home and explicitly opens NexusField Web | Repeated headed export |
| Loading, empty, and error surfaces could render at the same time | Generated routes now register mutually exclusive view-state markers and activate exactly one state | Generic generator test plus final Android screenshots |
| A persisted client token could outlive a restarted local backend | Generated clients validate the stored token against `/auth/session`, clear stale state, and guide the user to sign in again | Generic generator/backend tests, independent Web export, and physical Android sign-in/relaunch |
| Offline mode kept the shell available but could not preserve a user mutation | Generated remote data clients queue only offline mutations, never credentials, replay serially on `online`, keep failed entries, refresh bindings, and expose plain-language queued/synchronized feedback | Generic generator tests plus headed Web and physical Android queue/replay verifiers |
| Dynamic routes such as `/bookings/:id` were emitted but matched as literal strings | Generated routing now matches equal-length path segments and treats named parameters as wildcards for visibility and bound-data refresh | Generic generator assertion and independent `/bookings/offline-test` export verification |
| Two simultaneous Kyro windows could expose the wrong live project to an agent job | Live state, Codex jobs, and deterministic commands carry a stable client ID and use the requesting window's exact graph revision | Agent-context tests plus repeated Web/Mobile Ask Codex runs |
| A generated backend test could talk to an already running export on port 8787 | Generated backends accept a local `PORT`; the test reserves a free port and remains isolated | Generated backend integration test while NexusField backend remains active |
| First-run Electron/Vite optimization exceeded the generic Playwright timeout | The production-shell scenario has an explicit cold-start budget while preserving its functional assertions | Targeted cold-start run and full Playwright suite |

No fix checks project names, test data, or Playwright state. All fixes operate in the shared generator/runtime.

## Reproducible commands

```bash
npm run check
npx playwright test --workers=1 --max-failures=10
npm run desktop:package
$env:RUN_PACKAGED_DESKTOP='1'; npx playwright test e2e/desktop-packaged.spec.ts --workers=1
node scripts/nexusfield-verify-final-export.mjs
node scripts/nexusfield-verify-offline-sync.mjs
node scripts/nexusfield-verify-android-offline-sync.mjs
adb install -r app-debug.apk
```

Final results: 127/127 Vitest tests passed; 48/48 enabled Playwright tests passed with three separately gated scenarios; the production Electron shell passed its cold-start test; the independent Web/PWA build and runtime verifier passed; the physical Android package launched, authenticated, and retained its session without fatal runtime errors.

## Evidence package

All release assets are public at https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v0.1.15 and carry GitHub-verified SHA-256 digests.

- `artifacts/nexusfield/NexusField-Web-export.zip`
- `artifacts/nexusfield/NexusField-Mobile-debug.apk`
- `artifacts/nexusfield/NexusField-Web-final-trace.zip`
- `artifacts/nexusfield/NexusField-Web-offline-sync-trace.zip`
- `artifacts/nexusfield/raw-video/`
- `artifacts/nexusfield/Kyro-Hackathon-Demo-Final.mp4` (162.5 seconds, 1920×1080, English neural narration)
- Screenshots in `artifacts/nexusfield/`

## Observed external limitations

Remote push registration requires a provider project and credentials (for example FCM/APNs); the Android permission and local notifications are fully verified, while remote push is not simulated. Production APK/store signing and a publicly trusted desktop installer require release certificates. `npm audit --omit=dev` reports zero runtime vulnerabilities; the full development-tree audit reports high-severity advisories without an available fix in Electron Forge's packaging-only `tar`/`tmp` chain. That chain is not part of the supported repository-first CLI install. GitHub-hosted runners are currently unavailable on the repository account, so the optional desktop workflow is manual-only and the published packages use the documented local test/build evidence. Publishing the final MP4 to a public YouTube URL and submitting the Devpost form require the entrant's external accounts.
