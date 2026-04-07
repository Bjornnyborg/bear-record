import type { SourceInfo, AppSettings, TranscodeRequest, TranscodeResult, FtpSettings } from '../shared/types'

interface FtpUploadProgress {
  bytesTransferred: number
  totalBytes: number
  percent: number
}

interface FtpUploadResult {
  success: boolean
  url: string
  error?: string
}

interface FtpTestResult {
  success: boolean
  error?: string
}

declare global {
  interface Window {
    electronAPI: {
      getSources: () => Promise<SourceInfo[]>
      selectRegion: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      sendRegionResult: (r: { x: number; y: number; width: number; height: number }) => void
      sendRegionCancel: () => void
      sendChunk: (buf: ArrayBuffer) => void
      stopRecording: () => Promise<string>
      sendWebcamChunk: (buf: ArrayBuffer) => void
      startWebcamSession: () => Promise<void>
      stopWebcamSession: () => Promise<string | null>
      transcode: (req: TranscodeRequest) => Promise<TranscodeResult>
      onTranscodeProgress: (cb: (pct: number) => void) => () => void
      getSettings: () => Promise<AppSettings>
      setSettings: (s: Partial<AppSettings>) => Promise<void>
      openFile: (path: string) => Promise<void>
      openFolder: (path: string) => Promise<void>
      showFolderPicker: () => Promise<string | null>
      ftpUpload: (filePath: string, ftpSettings: FtpSettings) => Promise<FtpUploadResult>
      onFtpUploadProgress: (cb: (progress: FtpUploadProgress) => void) => () => void
      ftpTest: (ftpSettings: FtpSettings) => Promise<FtpTestResult>
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
      copyToClipboard: (text: string) => void
      openPermissionSettings: (type: 'screen' | 'camera') => Promise<void>
    }
  }
}

export {}
