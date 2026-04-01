// IPC channel names
export const IPC = {
  SOURCES_GET: 'sources:get',
  REGION_SELECT: 'region:select',
  REGION_CANCEL: 'region:cancel',
  REGION_RESULT: 'region:result',
  RECORDING_CHUNK: 'recording:chunk',
  RECORDING_STOP: 'recording:stop',
  RECORDING_TRANSCODE: 'recording:transcode',
  TRANSCODE_PROGRESS: 'transcode:progress',
  TRANSCODE_DONE: 'transcode:done',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SHELL_OPEN_FILE: 'shell:openFile',
  SHELL_OPEN_FOLDER: 'shell:openFolder',
  SHOW_FOLDER_PICKER: 'shell:showFolderPicker',
  HUD_OPEN: 'hud:open',
  HUD_CLOSE: 'hud:close',
  HUD_STOP: 'hud:stop',
  HUD_PAUSE: 'hud:pause',
  APP_READY: 'app:ready'
} as const

export interface SourceInfo {
  id: string
  name: string
  thumbnailDataUrl: string
  type: 'screen' | 'window'
}

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

export type CaptureTarget =
  | { kind: 'fullscreen'; sourceId: string; sourceName: string }
  | { kind: 'window'; sourceId: string; sourceName: string }
  | { kind: 'region'; sourceId: string; sourceName: string; region: Region }

export type QualityPreset = 'good' | 'high' | 'maximum'

export interface AudioSettings {
  micEnabled: boolean
  micDeviceId: string | null
  systemEnabled: boolean
}

export interface WebcamSettings {
  enabled: boolean
  deviceId: string | null
}

export interface RecordingSettings {
  captureTarget: CaptureTarget | null
  audio: AudioSettings
  webcam: WebcamSettings
  quality: QualityPreset
  outputFolder: string
}

export interface TranscodeRequest {
  inputPath: string
  webcamPath: string | null
  outputPath: string
  quality: QualityPreset
  region: Region | null
  recordingDurationSec: number // Duration of the recording in seconds, for progress calculation
}

export interface TranscodeResult {
  outputPath: string
  durationMs: number
  fileSizeBytes: number
  thumbnailDataUrl: string
}

export interface AppSettings {
  quality: QualityPreset
  outputFolder: string
  micEnabled: boolean
  micDeviceId: string | null
  systemEnabled: boolean
  webcamEnabled: boolean
  webcamDeviceId: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  quality: 'high',
  outputFolder: '',
  micEnabled: true,
  micDeviceId: null,
  systemEnabled: true,
  webcamEnabled: false,
  webcamDeviceId: null
}
