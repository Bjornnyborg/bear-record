# Bear Record

A local, privacy-first screen recorder for Windows, macOS, and Linux. No cloud. No subscriptions. Just record and save.

---

## Features

- **Flexible capture** — fullscreen, specific window, or custom drag-selected region
- **High-quality MP4 output** — H.264 with configurable quality presets (Good / High / Maximum)
- **Webcam overlay** — picture-in-picture from any connected camera
- **Audio recording** — microphone, system audio, or both simultaneously
- **3-second countdown** — compose yourself before the recording starts
- **Floating HUD** — stop/pause controls that stay on top without being captured
- **No FFmpeg installation required** — bundled with the app

---

## Tech Stack

Electron + React (TypeScript) + FFmpeg (`ffmpeg-static`) + Tailwind CSS

---

## Quick Start (Development)

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for full setup instructions.

```bash
git clone https://github.com/yourname/bear-record.git
cd bear-record
npm install
npm run dev
```

---

## Building an Installer

Make sure you run the terminal as admin

```bash
npm run dist
```

Outputs to `dist/` — produces `.exe` on Windows, `.dmg` on macOS, `.AppImage` on Linux.

See [docs/RELEASE.md](docs/RELEASE.md) for signing and CI details.

---

## Output

Recordings are saved to `~/Videos/BearRecord/` as `BearRecord-YYYY-MM-DD-HH-mm-ss.mp4`.

---

## Project Docs

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, component map |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup and development workflow |
| [docs/RELEASE.md](docs/RELEASE.md) | Building installers and cutting releases |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased implementation plan with checkboxes |

---

## License

MIT
