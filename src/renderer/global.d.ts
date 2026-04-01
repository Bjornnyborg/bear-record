import type { SourceInfo, AppSettings, TranscodeRequest, TranscodeResult } from '../shared/types'

declare global {
  interface Window {
    electronAPI: {
      getSources: () => Promise<SourceInfo[]>
      selectRegion: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      sendRegionResult: (r: { x: number; y: number; width: number; height: number }) => void
      sendRegionCancel: () => void
      sendChunk: (buf: ArrayBuffer) => void
      stopRecording: () => Promise<string>
      transcode: (req: TranscodeRequest) => Promise<TranscodeResult>
      onTranscodeProgress: (cb: (pct: number) => void) => () => void
      getSettings: () => Promise<AppSettings>
      setSettings: (s: Partial<AppSettings>) => Promise<void>
      openFile: (path: string) => Promise<void>
      openFolder: (path: string) => Promise<void>
      showFolderPicker: () => Promise<string | null>
      openHud: () => Promise<void>
      closeHud: () => Promise<void>
      onHudStop: (cb: () => void) => () => void
      onHudPause: (cb: (paused: boolean) => void) => () => void
      sendHudStop: () => void
      sendHudPause: (paused: boolean) => void
      minimizeWindow: () => void
      closeWindow: () => void
      hideWindow: () => Promise<void>
      showWindow: () => Promise<void>
      platform: string
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
}

export {}
