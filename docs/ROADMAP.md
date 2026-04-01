# Implementation Roadmap

Track progress by checking off items as they are completed.

---

## Phase 1 — Project Scaffold (Days 1–2)

Goal: Working Electron + React + TypeScript app with hot reload.

- [ ] Initialize `package.json` with all core dependencies
- [ ] Configure `electron-vite` with `vite.config.ts`
- [ ] Write `src/main/main.ts` — create `BrowserWindow`, load renderer
- [ ] Write `src/main/preload.ts` — expose typed `window.electronAPI` via `contextBridge`
- [ ] Write `src/shared/types.ts` — all IPC channel names and payload interfaces
- [ ] Scaffold `App.tsx` with state machine enum and placeholder page renders
- [ ] Set up Tailwind CSS with dark theme
- [ ] Verify `npm run dev` launches with hot reload

---

## Phase 2 — Settings Screen and Source Selection (Days 3–5)

Goal: Fully functional settings screen — pick capture source, webcam, audio, then hit Record.

- [ ] `src/main/sources.ts` — `desktopCapturer.getSources()` exposed over IPC
- [ ] `useMediaSources` hook — returns screen/window list with thumbnail images
- [ ] `SourcePicker` component — thumbnail grid, click to select
- [ ] `useWebcam` hook — `getUserMedia({ video: true })`, enumerate cameras
- [ ] `WebcamPreview` component — live feed thumbnail
- [ ] `useAudioMixer` hook — enumerate mic devices, handle system audio flag
- [ ] `AudioMeter` component — live level bar using `AnalyserNode`
- [ ] `SettingsPage` — assembles all above; sections: Source, Camera, Audio, Output
- [ ] Quality presets (Good / High / Maximum) wired to FFmpeg CRF values
- [ ] Output folder picker
- [ ] Persist settings with `electron-store` via IPC

---

## Phase 3 — Countdown, Recording Loop, and HUD (Days 6–9)

Goal: Full recording loop — countdown → capture → floating HUD → stop → raw WebM file.

- [ ] `CountdownOverlay` — full-screen animated 3-2-1 using `framer-motion`
- [ ] Call `getDisplayMedia` with selected `sourceId` on countdown complete
- [ ] Call `getUserMedia` for mic (if enabled) and webcam (if enabled)
- [ ] System audio capture via `getDisplayMedia({ audio: true })` (Windows WASAPI loopback)
- [ ] `useAudioMixer` — merge mic + system audio via `AudioContext` nodes
- [ ] `OffscreenCanvas` Web Worker compositor — screen + PiP webcam at 30fps
- [ ] `MediaRecorder` — `video/webm;codecs=vp9,opus`, chunks written to temp file via IPC
- [ ] `src/main/temp.ts` — manage temp session files under `app.getPath('temp')/bear-record/`
- [ ] `RecordingHUD` — second `BrowserWindow` (`alwaysOnTop`, `transparent`): timer, pause, stop
- [ ] On stop: flush `MediaRecorder`, close write stream, transition to Processing

---

## Phase 4 — FFmpeg Transcoding and Output (Days 10–12)

Goal: Raw WebM transcoded to MP4. User sees progress and gets the final file.

- [ ] `src/main/ffmpeg.ts` — `FFmpegRunner` class wrapping `fluent-ffmpeg`
- [ ] Resolve `ffmpeg-static` binary path correctly per OS
- [ ] Quality preset flags wired to `-crf` and `-preset` values
- [ ] Parse FFmpeg stderr `time=` output for progress percentage
- [ ] `recording:transcode` IPC handler — streams progress events to renderer
- [ ] `ProcessingScreen` component — progress bar, estimated time, filename
- [ ] Delete temp WebM after successful transcode
- [ ] Output to `~/Videos/BearRecord/BearRecord-YYYY-MM-DD-HH-mm-ss.mp4`
- [ ] Extract first-frame thumbnail via FFmpeg `-vframes 1`
- [ ] `DonePage` — thumbnail, file size, duration, Open File, Open Folder, Record Again

---

## Phase 5 — Region Selection (Days 13–14)

Goal: User can drag a custom area on screen instead of picking fullscreen or a window.

- [ ] Transparent fullscreen overlay `BrowserWindow` (`alwaysOnTop`, `transparent`, `frame: false`)
- [ ] Dark overlay with bright cutout rect on drag (using canvas or CSS `mix-blend-mode`)
- [ ] Emit `{ x, y, width, height }` back to settings window via IPC on mouseup
- [ ] Show selected dimensions as confirmation in settings screen
- [ ] Pass region as `-vf crop=w:h:x:y` to FFmpeg during transcode

---

## Phase 6 — Polish and Distribution (Days 15–18)

Goal: Shippable installers for all three platforms.

- [ ] Write `electron-builder.yml` — NSIS (Windows), DMG (macOS), AppImage + deb (Linux)
- [ ] App icon at 16, 32, 48, 128, 256, 512px in `assets/`
- [ ] System tray icon with right-click menu (Show / Quit)
- [ ] Graceful error dialogs for recording failures
- [ ] `npm run dist` produces working installers on CI
- [ ] `.github/workflows/release.yml` CI pipeline (see RELEASE.md)
- [ ] `electron-updater` auto-update from GitHub Releases
- [ ] Final review of all docs

---

## Future Ideas (Post-v1)

- Pause and resume recording
- Annotate / draw on screen while recording
- Trim recording before saving (in-app editor)
- GIF export option
- Share link via local web server (LAN)
- Custom output filename templates
