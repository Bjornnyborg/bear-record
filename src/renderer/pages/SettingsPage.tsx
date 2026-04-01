import React, { useEffect } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Camera, Folder, Video } from 'lucide-react'
import SourcePicker from '../components/SourcePicker'
import WebcamPreview from '../components/WebcamPreview'
import AudioMeter from '../components/AudioMeter'
import { useSettingsStore } from '../store/settingsStore'
import { useWebcam } from '../hooks/useWebcam'
import { useAudioMixer } from '../hooks/useAudioMixer'

interface Props {
  onRecord: () => void
}

const QUALITY_LABELS = { good: 'Good', high: 'High', maximum: 'Maximum' } as const

export default function SettingsPage({ onRecord }: Props) {
  const store = useSettingsStore()
  const { devices: webcamDevices, stream: webcamStream } = useWebcam(store.webcam.enabled, store.webcam.deviceId)
  const { devices: micDevices, level } = useAudioMixer(store.audio.micEnabled, store.audio.micDeviceId)

  useEffect(() => { store.loadFromMain() }, [])

  const pickFolder = async () => {
    const folder = await window.electronAPI.showFolderPicker()
    if (folder) store.setOutputFolder(folder)
  }

  const canRecord = store.captureTarget !== null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Source */}
        <section>
          <SectionLabel icon={<Video size={14} />} title="What to record" />
          <SourcePicker selected={store.captureTarget} onSelect={store.setCaptureTarget} />
        </section>

        <Divider />

        {/* Camera */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel icon={<Camera size={14} />} title="Camera" />
            <Toggle
              enabled={store.webcam.enabled}
              onToggle={() => store.setWebcam({ enabled: !store.webcam.enabled })}
            />
          </div>
          <div className={`flex items-center gap-4 transition-opacity ${store.webcam.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <WebcamPreview stream={webcamStream} />
            <div className="flex-1">
              <Select
                value={store.webcam.deviceId ?? ''}
                onChange={(v) => store.setWebcam({ deviceId: v || null })}
                options={webcamDevices.map((d) => ({ value: d.deviceId, label: d.label }))}
                placeholder="Default camera"
              />
            </div>
          </div>
        </section>

        <Divider />

        {/* Audio */}
        <section>
          <SectionLabel icon={<Mic size={14} />} title="Audio" />
          <div className="space-y-3">
            {/* Microphone row */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => store.setAudio({ micEnabled: !store.audio.micEnabled })}
                className={`p-2 rounded-lg border transition-colors ${store.audio.micEnabled ? 'border-bear-accent text-bear-accent' : 'border-bear-border text-bear-muted'}`}
              >
                {store.audio.micEnabled ? <Mic size={15} /> : <MicOff size={15} />}
              </button>
              <div className="flex-1">
                <Select
                  value={store.audio.micDeviceId ?? ''}
                  onChange={(v) => store.setAudio({ micDeviceId: v || null })}
                  options={micDevices.map((d) => ({ value: d.deviceId, label: d.label }))}
                  placeholder="Default microphone"
                  disabled={!store.audio.micEnabled}
                />
              </div>
              <AudioMeter level={level} enabled={store.audio.micEnabled} />
            </div>

            {/* System audio row */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => store.setAudio({ systemEnabled: !store.audio.systemEnabled })}
                className={`p-2 rounded-lg border transition-colors ${store.audio.systemEnabled ? 'border-bear-accent text-bear-accent' : 'border-bear-border text-bear-muted'}`}
              >
                {store.audio.systemEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <span className="text-sm text-bear-muted flex-1">System audio</span>
              <span className="text-xs text-bear-muted">
                {window.electronAPI.platform === 'win32' ? 'WASAPI loopback' : 'Check OS settings'}
              </span>
            </div>
          </div>
        </section>

        <Divider />

        {/* Output */}
        <section>
          <SectionLabel icon={<Folder size={14} />} title="Output" />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-bear-muted w-16">Quality</span>
              <div className="flex gap-1">
                {(['good', 'high', 'maximum'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => store.setQuality(q)}
                    className={`px-3 py-1 rounded-lg text-xs border transition-colors capitalize ${
                      store.quality === q
                        ? 'border-bear-accent text-bear-accent bg-bear-accent/10'
                        : 'border-bear-border text-bear-muted hover:border-bear-muted'
                    }`}
                  >
                    {QUALITY_LABELS[q]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-bear-muted w-16">Folder</span>
              <button
                onClick={pickFolder}
                className="flex-1 text-left px-3 py-1.5 rounded-lg border border-bear-border text-xs text-bear-muted hover:border-bear-muted hover:text-bear-text transition-colors truncate"
              >
                {store.outputFolder || '~/Videos/BearRecord'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Record button */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-bear-border">
        <button
          onClick={onRecord}
          disabled={!canRecord}
          className={`w-full py-3 rounded-xl text-base font-semibold tracking-wide transition-all ${
            canRecord
              ? 'bg-bear-accent hover:bg-bear-accent-hover text-white shadow-lg shadow-bear-accent/20 active:scale-95'
              : 'bg-bear-border text-bear-muted cursor-not-allowed'
          }`}
        >
          {canRecord ? '● Start Recording' : 'Select a screen or window to record'}
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-bear-muted">{icon}</span>
      <span className="text-sm font-medium text-bear-text">{title}</span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-bear-border" />
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-bear-accent' : 'bg-bear-border'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}

function Select({ value, onChange, options, placeholder, disabled }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-bear-surface border border-bear-border rounded-lg px-3 py-1.5 text-sm text-bear-text disabled:opacity-40 outline-none focus:border-bear-accent transition-colors"
    >
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
