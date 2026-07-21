# Kyro demo — voice recording script

Target: **2 minutes 47 seconds**. Speak conversationally, around 125 words per minute. The pauses are intentional; do not rush to fill them.

## 00:00–00:16 — The problem

Kyro started from a simple frustration. Visual tools are easy until an app needs real behavior, while coding agents spend time rediscovering the project. Kyro joins both in one open visual graph.

## 00:16–00:53 — Start and Design

I can start from a blank canvas, a template, or an existing folder. In Design, I add real interface elements, organize layers, create columns, resize directly, and control color, typography, spacing, states, animation, and accessibility. Desktop, tablet, and mobile are responsive views of the same editable components. This is not a mock-up. Every element already knows its intent, events, data, dependencies, and generated files.

## 00:53–01:13 — Ask Codex and a difficult request

Now I select a button and open Ask Codex from the context menu. Kyro sends GPT‑5.6 the stable element, a compact graph slice, connected flows and data, errors, screenshot, and revision. For this PDF, QR code, digital signature, and SMTP request, Codex does not pretend the feature exists. It proposes a reusable global capability with typed inputs, permissions, dependencies, tests, and an explicit review gate.

## 01:13–01:23 — Measured context advantage

In matched three-run tests, Kyro planning was just over three times faster and used about ninety-two percent fewer tokens than repository-first Codex CLI. The exact prompts, raw values, and limitations are public in the repository.

## 01:23–01:36 — Flow

Behavior remains visual. An event enters this Node-RED-style flow, validation branches, data is updated, the interface refreshes, and success and error paths stay visible, traceable, and reusable.

## 01:36–01:52 — Data and capability resolution

Data creates local IndexedDB or REST sources, schemas, relationships, permissions, and bindings. If an idea needs a backend, device permission, external provider, or package, the Capability Resolver advises Codex. Nothing is installed, connected, or activated without the required review.

## 01:52–02:08 — Preview

Preview runs the same verified graph used by export. NexusField Web and Mobile were built through Kyro and tested with authentication, role guards, real data mutations, responsive layouts, empty and error states, and offline queue and replay.

## 02:08–02:20 — Publish

Publish generates readable TypeScript and Vite, an offline PWA, or a Capacitor Android project. The result runs independently and remains editable outside Kyro, so there is no platform lock-in.

## 02:20–02:39 — Physical Android result

Here the generated Android app is running on a physical phone. Authentication persists, native camera and notification permissions use the operating system flow, and an offline mutation is queued and synchronized after reconnection. The APK was built and updated with a real Android toolchain.

## 02:39–02:47 — Close

Codex and GPT‑5.6 helped us build, test, visually verify, and deploy Kyro. Kyro gives that same power to visual creators: inspectable, undoable, local-first, and open.

## Recording checklist

- Record in English in a quiet room, ideally as WAV, 48 kHz, mono or stereo.
- Keep the microphone 15–20 cm away and do one complete natural take.
- Leave half a second of silence at the beginning and end.
- Say “Codex” and “GPT‑5.6” clearly; do not replace them with “AI”.
- No background music is needed.
- Save the file as `kyro-voice.wav` or `kyro-voice.mp3`; it can be inserted with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-hackathon-video.ps1 -NarrationPath kyro-voice.wav
```
