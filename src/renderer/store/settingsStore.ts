import { create } from 'zustand'
import type { CaptureTarget, QualityPreset, AudioSettings, WebcamSettings } from '../../shared/types'

interface SettingsState {
  captureTarget: CaptureTarget | null
  audio: AudioSettings
  webcam: WebcamSettings
  quality: QualityPreset
  outputFolder: string
  loaded: boolean

  setCaptureTarget: (t: CaptureTarget | null) => void
  setAudio: (a: Partial<AudioSettings>) => void
  setWebcam: (w: Partial<WebcamSettings>) => void
  setQuality: (q: QualityPreset) => void
  setOutputFolder: (f: string) => void
  loadFromMain: () => Promise<void>
  saveToMain: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  captureTarget: null,
  audio: { micEnabled: true, micDeviceId: null, systemEnabled: true },
  webcam: { enabled: false, deviceId: null },
  quality: 'high',
  outputFolder: '',
  loaded: false,

  setCaptureTarget: (captureTarget) => {
    set({ captureTarget })
    get().saveToMain()
  },

  setAudio: (patch) => {
    set((s) => ({ audio: { ...s.audio, ...patch } }))
    get().saveToMain()
  },

  setWebcam: (patch) => {
    set((s) => ({ webcam: { ...s.webcam, ...patch } }))
    get().saveToMain()
  },

  setQuality: (quality) => {
    set({ quality })
    get().saveToMain()
  },

  setOutputFolder: (outputFolder) => {
    set({ outputFolder })
    get().saveToMain()
  },

  loadFromMain: async () => {
    const s = await window.electronAPI.getSettings()
    set({
      audio: {
        micEnabled: s.micEnabled,
        micDeviceId: s.micDeviceId,
        systemEnabled: s.systemEnabled
      },
      webcam: { enabled: s.webcamEnabled, deviceId: s.webcamDeviceId },
      quality: s.quality,
      outputFolder: s.outputFolder,
      loaded: true
    })
  },

  saveToMain: () => {
    const { audio, webcam, quality, outputFolder } = get()
    window.electronAPI.setSettings({
      micEnabled: audio.micEnabled,
      micDeviceId: audio.micDeviceId,
      systemEnabled: audio.systemEnabled,
      webcamEnabled: webcam.enabled,
      webcamDeviceId: webcam.deviceId,
      quality,
      outputFolder
    })
  }
}))
