# Architecture

## Overview

Bear Record is an Electron desktop application. The main process (Node.js) handles system-level operations — screen source enumeration, file I/O, and FFmpeg invocation. The renderer process (React) handles UI and media capture via browser APIs.

---

## Component Map

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ AppLifecycle│  │ RecordingMgr │  │  FFmpegRunner │  │
│  │  (main.ts)  │  │(recording.ts)│  │  (ffmpeg.ts)  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                │                  │           │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼───────┐  │
│  │  IPC Bridge │  │ TempFilesMgr│  │  SourcePicker │  │
│  │  (ipc.ts)   │  │  (temp.ts)  │  │  (sources.ts) │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │ contextBridge / ipcRenderer
┌───────────────────────────▼─────────────────────────────┐
│                   Renderer Process (React)              │
│                                                         │
│  ┌─────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │SettingsPage │  │CountdownOverlay│  │ RecordingHUD│  │
│  └─────────────┘  └────────────────┘  └─────────────┘  │
│         │                                               │
│  ┌──────▼──────────────────────────────────────────┐   │
│  │              useRecording hook                   │   │
│  │  (state machine: idle→settings→countdown→        │   │
│  │   recording→processing→done)                    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                   Native OS Layer                       │
│  Windows DXGI / macOS ScreenCaptureKit / Linux PipeWire │
│  (abstracted by Electron desktopCapturer + MediaStream) │
└─────────────────────────────────────────────────────────┘
```

---

## Recording Pipeline (Data Flow)

```
Screen Region
   │  getDisplayMedia({ video: { mandatory: { chromeMediaSource: 'desktop' }}})
   ▼
MediaStream (video track)
                                         │
Webcam                                   │
   │  getUserMedia({ video: true })      │
   ▼                                     │
MediaStream ──► OffscreenCanvas compositor (Web Worker)
                      │  captureStream(30fps)
                      ▼
Microphone + System Audio
   │  AudioContext merge (MediaStreamAudioDestinationNode)
   ▼
MediaRecorder (video/webm;codecs=vp9,opus)
   │  ondataavailable → IPC → write chunks to temp .webm
   ▼
temp/recording-TIMESTAMP.webm

[user stops]
   │
FFmpegRunner (main process)
   │  libx264 + aac transcode with quality preset
   ▼
~/Videos/BearRecord/BearRecord-YYYY-MM-DD-HH-mm-ss.mp4
```

---

## State Machine

```
IDLE ──launch──► SETTINGS ──record──► COUNTDOWN (3s)
                                            │
                                       RECORDING ──stop──► PROCESSING
                                                                │
                                                           DONE
```

---

## Folder Structure

```
bear-record/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── main.ts        # BrowserWindow creation, app lifecycle
│   │   ├── ipc.ts         # All ipcMain.handle() registrations
│   │   ├── recording.ts   # Orchestrates recording session
│   │   ├── ffmpeg.ts      # FFmpegRunner — wraps fluent-ffmpeg
│   │   ├── sources.ts     # desktopCapturer source enumeration
│   │   ├── temp.ts        # Temp file path management
│   │   └── preload.ts     # contextBridge exposure
│   │
│   ├── renderer/          # React app
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx        # Top-level state machine router
│   │   ├── pages/
│   │   │   ├── SettingsPage.tsx
│   │   │   └── DonePage.tsx
│   │   ├── components/
│   │   │   ├── CountdownOverlay.tsx
│   │   │   ├── RecordingHUD.tsx    # Floating always-on-top toolbar
│   │   │   ├── SourcePicker.tsx
│   │   │   ├── WebcamPreview.tsx
│   │   │   ├── AudioMeter.tsx
│   │   │   └── ProcessingScreen.tsx
│   │   ├── hooks/
│   │   │   ├── useRecording.ts     # Main state machine
│   │   │   ├── useMediaSources.ts
│   │   │   ├── useWebcam.ts
│   │   │   └── useAudioMixer.ts
│   │   └── store/
│   │       └── settingsStore.ts    # Zustand + electron-store persistence
│   │
│   └── shared/
│       └── types.ts       # Shared TS interfaces for IPC payloads
│
├── assets/                # App icons
├── docs/                  # Project documentation
└── dist/                  # Build output (gitignored)
```

---

## Key Technical Notes

### Windows System Audio

`getDisplayMedia({ audio: true })` on Windows uses WASAPI loopback automatically — no drivers needed. The audio track is part of the display stream alongside video.

On macOS <13, system audio capture requires a virtual audio device (BlackHole). The app detects the OS and disables the option with a setup guide link if unsupported.

### HUD Window Not Captured

The floating `RecordingHUD` runs in a second `BrowserWindow` with `alwaysOnTop: true` and `transparent: true`. It is created *after* the `desktopCapturer` source is locked in, so it is never included in the captured stream. Electron 28+ also supports `excludeWindowsFromCapture`.

### WebM → MP4 Quality

MediaRecorder produces VP9/Opus WebM (lossless intermediate). FFmpeg transcodes to H.264/AAC MP4:

| Preset | FFmpeg flags | Use case |
|---|---|---|
| Good | `-crf 23 -preset fast` | Quick previews, smaller files |
| High | `-crf 18 -preset slow` | Default — excellent quality |
| Maximum | `-crf 14 -preset veryslow` | Near-lossless, larger files |

Transcode time is roughly 1–3 minutes per 5 minutes of 1080p footage at `preset slow`.

### Canvas Compositor Performance

The PiP webcam overlay is composited in a Web Worker using `OffscreenCanvas` to avoid blocking the UI thread. Screen frames and webcam frames are drawn each `requestAnimationFrame` cycle before being fed into `MediaRecorder`.
