import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  // Sources
  getSources: () => ipcRenderer.invoke(IPC.SOURCES_GET),

  // Region selection
  selectRegion: () => ipcRenderer.invoke(IPC.REGION_SELECT),
  sendRegionResult: (region: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.send(IPC.REGION_RESULT, region),
  sendRegionCancel: () => ipcRenderer.send(IPC.REGION_CANCEL),

  // Recording data — send as Uint8Array so Electron can serialize it over IPC
  sendChunk: (buffer: ArrayBuffer) => ipcRenderer.send(IPC.RECORDING_CHUNK, new Uint8Array(buffer)),
  stopRecording: () => ipcRenderer.invoke(IPC.RECORDING_STOP),
  sendWebcamChunk: (buffer: ArrayBuffer) => ipcRenderer.send('webcam:chunk', new Uint8Array(buffer)),
  startWebcamSession: () => ipcRenderer.invoke('webcam:start'),
  stopWebcamSession: () => ipcRenderer.invoke('webcam:stop'),

  // Transcoding
  transcode: (req: import('../shared/types').TranscodeRequest) =>
    ipcRenderer.invoke(IPC.RECORDING_TRANSCODE, req),
  onTranscodeProgress: (cb: (pct: number) => void) => {
    const handler = (_: unknown, pct: number) => cb(pct)
    ipcRenderer.on(IPC.TRANSCODE_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSCODE_PROGRESS, handler)
  },

  // Settings persistence
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (s: Partial<import('../shared/types').AppSettings>) =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, s),

  // Shell
  openFile: (path: string) => ipcRenderer.invoke(IPC.SHELL_OPEN_FILE, path),
  openFolder: (path: string) => ipcRenderer.invoke(IPC.SHELL_OPEN_FOLDER, path),
  showFolderPicker: () => ipcRenderer.invoke(IPC.SHOW_FOLDER_PICKER),

  // HUD control
  openHud: () => ipcRenderer.invoke(IPC.HUD_OPEN),
  closeHud: () => ipcRenderer.invoke(IPC.HUD_CLOSE),
  onHudStop: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on(IPC.HUD_STOP, handler)
    return () => ipcRenderer.removeListener(IPC.HUD_STOP, handler)
  },
  onHudPause: (cb: (paused: boolean) => void) => {
    const handler = (_: unknown, paused: boolean) => cb(paused)
    ipcRenderer.on(IPC.HUD_PAUSE, handler)
    return () => ipcRenderer.removeListener(IPC.HUD_PAUSE, handler)
  },
  sendHudStop: () => ipcRenderer.send(IPC.HUD_STOP),
  sendHudPause: (paused: boolean) => ipcRenderer.send(IPC.HUD_PAUSE, paused),

  // General invoke passthrough for ad-hoc channels
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  showWindow: () => ipcRenderer.invoke('window:show'),

  // Platform
  platform: process.platform
})
