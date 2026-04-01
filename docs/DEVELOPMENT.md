# Development Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | Use [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows) |
| npm | 10+ | Comes with Node 20 |
| Git | any | |

No need to install FFmpeg — it is bundled via `ffmpeg-static`.

---

## Setup

```bash
git clone https://github.com/yourname/bear-record.git
cd bear-record
npm install
```

---

## Running in Dev Mode

```bash
npm run dev
```

This starts:
- Vite dev server for the renderer (with hot module replacement)
- Electron main process watching `src/main/` for changes

The app window opens automatically.

---

## Project Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev mode with HMR |
| `npm run build` | Compile TypeScript + bundle renderer |
| `npm run dist` | Build + package installers (see RELEASE.md) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run `tsc --noEmit` for both main and renderer |

---

## Environment Notes

### Windows

- System audio capture works out of the box via WASAPI loopback.
- If you see a blank screen picker, ensure Electron has screen recording permission (Settings → Privacy → Screen Recording on Windows 11).

### macOS

- Grant screen recording permission in System Settings → Privacy & Security → Screen Recording.
- System audio capture on macOS <13 requires [BlackHole](https://github.com/ExistentialAudio/BlackHole). The app will show a setup guide if system audio is unavailable.
- Code signing is required to distribute outside the App Store. See [docs/RELEASE.md](RELEASE.md).

### Linux

- Screen capture uses PipeWire (Wayland) or X11. Install `xdg-desktop-portal-wlr` if on Wayland.
- Test with: `npm run dev -- --enable-features=UseOzonePlatform --ozone-platform=wayland`

---

## Adding a New IPC Channel

1. Define the channel name and payload types in `src/shared/types.ts`.
2. Register the handler in `src/main/ipc.ts` using `ipcMain.handle('channel-name', handler)`.
3. Expose it in `src/main/preload.ts` via `contextBridge.exposeInMainWorld`.
4. Call it from the renderer via `window.electronAPI.channelName(payload)`.

---

## Known Issues

- **Canvas compositor at 4K**: PiP compositing at 4K@60fps may drop frames on integrated graphics. The workaround is to cap at 1080p or 30fps.
- **macOS system audio**: Blocked by OS until ScreenCaptureKit entitlement is granted. Tracked in issue #12.
