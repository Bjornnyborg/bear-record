import React, { useEffect, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Camera, Folder, Video, Upload, CheckCircle, XCircle, Loader, ShieldAlert } from 'lucide-react'
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
  const { devices: webcamDevices, stream: webcamStream, requestPermission: requestCameraPermission } = useWebcam(store.webcam.enabled, store.webcam.deviceId)
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
            <div className="flex-1 flex flex-col gap-2">
              <Select
                value={store.webcam.deviceId ?? ''}
                onChange={(v) => store.setWebcam({ deviceId: v || null })}
                options={webcamDevices.map((d) => ({ value: d.deviceId, label: d.label }))}
                placeholder="Default camera"
              />
              {store.webcam.enabled && webcamDevices.length === 0 && (
                <button
                  onClick={requestCameraPermission}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition-colors self-start"
                >
                  <ShieldAlert size={13} /> Check permissions
                </button>
              )}
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-bear-muted w-16">Filename</span>
              <input
                type="text"
                value={store.filenamePrefix}
                onChange={(e) => store.setFilenamePrefix(e.target.value)}
                placeholder="BearRecord"
                className="flex-1 px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text placeholder:text-bear-muted/50 focus:border-bear-muted focus:outline-none"
              />
            </div>
          </div>
        </section>

        <Divider />

        {/* FTP Upload */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel icon={<Upload size={16} />} title="FTP Upload" />
            <Toggle enabled={store.ftp.enabled} onToggle={() => store.setFtp({ enabled: !store.ftp.enabled })} />
          </div>
          
          {store.ftp.enabled && (
            <div className="space-y-3 pl-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                <span className="text-sm text-bear-muted">Host</span>
                <input
                  type="text"
                  value={store.ftp.host}
                  onChange={(e) => store.setFtp({ host: e.target.value })}
                  placeholder="ftp.example.com"
                  className="px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text placeholder:text-bear-muted/50 focus:border-bear-muted focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                <span className="text-sm text-bear-muted">Port</span>
                <input
                  type="number"
                  value={store.ftp.port}
                  onChange={(e) => store.setFtp({ port: parseInt(e.target.value) || 21 })}
                  className="px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text focus:border-bear-muted focus:outline-none w-24"
                />
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                <span className="text-sm text-bear-muted">Username</span>
                <input
                  type="text"
                  value={store.ftp.username}
                  onChange={(e) => store.setFtp({ username: e.target.value })}
                  placeholder="username"
                  className="px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text placeholder:text-bear-muted/50 focus:border-bear-muted focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                <span className="text-sm text-bear-muted">Password</span>
                <input
                  type="password"
                  value={store.ftp.password}
                  onChange={(e) => store.setFtp({ password: e.target.value })}
                  placeholder="••••••••"
                  className="px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text placeholder:text-bear-muted/50 focus:border-bear-muted focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                <span className="text-sm text-bear-muted">Remote Path</span>
                <input
                  type="text"
                  value={store.ftp.remotePath}
                  onChange={(e) => store.setFtp({ remotePath: e.target.value })}
                  placeholder="/uploads"
                  className="px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text placeholder:text-bear-muted/50 focus:border-bear-muted focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-2 items-center">
                <span className="text-sm text-bear-muted">URL Template</span>
                <input
                  type="text"
                  value={store.ftp.urlTemplate}
                  onChange={(e) => store.setFtp({ urlTemplate: e.target.value })}
                  placeholder="https://example.com/videos/{filename}"
                  className="px-3 py-1.5 rounded-lg border border-bear-border bg-transparent text-sm text-bear-text placeholder:text-bear-muted/50 focus:border-bear-muted focus:outline-none"
                />
              </div>
              <div className="text-xs text-bear-muted">Use {'{filename}'} as placeholder in URL template</div>
              <FtpTestButton />
            </div>
          )}
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

function FtpTestButton() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const store = useSettingsStore()

  const testConnection = async () => {
    setStatus('testing')
    setMessage('')
    try {
      const result = await window.electronAPI.ftpTest(store.ftp)
      if (result.success) {
        setStatus('success')
        setMessage('Connection successful!')
      } else {
        setStatus('error')
        setMessage(result.error || 'Connection failed')
      }
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={testConnection}
        disabled={status === 'testing' || !store.ftp.host || !store.ftp.username}
        className="px-4 py-1.5 rounded-lg text-sm font-medium bg-bear-surface border border-bear-border text-bear-text hover:border-bear-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {status === 'testing' ? (
          <>
            <Loader size={14} className="animate-spin" />
            Testing...
          </>
        ) : (
          'Test Connection'
        )}
      </button>
      {status === 'success' && (
        <span className="text-green-500 flex items-center gap-1 text-sm">
          <CheckCircle size={14} />
          {message}
        </span>
      )}
      {status === 'error' && (
        <span className="text-red-400 flex items-center gap-1 text-sm">
          <XCircle size={14} />
          {message}
        </span>
      )}
    </div>
  )
}
