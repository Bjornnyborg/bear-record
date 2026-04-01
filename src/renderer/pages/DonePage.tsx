import React, { useState, useEffect } from 'react'
import { FolderOpen, FileVideo, RotateCcw, Upload, CheckCircle, XCircle, Copy, Check, Loader } from 'lucide-react'
import type { TranscodeResult } from '../../shared/types'
import { useSettingsStore } from '../store/settingsStore'

interface Props {
  result: TranscodeResult
  onRecordAgain: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export default function DonePage({ result, onRecordAgain }: Props) {
  const fileName = result.outputPath.split(/[\\/]/).pop() ?? 'recording.mp4'
  const folder = result.outputPath.split(/[\\/]/).slice(0, -1).join('/')
  const ftp = useSettingsStore((s) => s.ftp)

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ftp.enabled && ftp.host && ftp.username) {
      startUpload()
    }
  }, [])

  const startUpload = async () => {
    setUploadStatus('uploading')
    setUploadProgress(0)
    setUploadError(null)

    // Listen for progress updates
    const removeListener = window.electronAPI.onFtpUploadProgress((progress) => {
      setUploadProgress(Math.round(progress.percent))
    })

    try {
      const uploadResult = await window.electronAPI.ftpUpload(result.outputPath, ftp)

      if (uploadResult.success && uploadResult.url) {
        setUploadStatus('success')
        setUploadUrl(uploadResult.url)
      } else {
        setUploadStatus('error')
        setUploadError(uploadResult.error || 'Upload failed')
      }
    } catch (err) {
      setUploadStatus('error')
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      removeListener()
    }
  }

  const copyUrl = () => {
    if (uploadUrl) {
      window.electronAPI.copyToClipboard(uploadUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-8">
      {/* Thumbnail or placeholder */}
      <div className="w-64 h-36 rounded-xl overflow-hidden border-2 border-bear-border bg-bear-surface flex items-center justify-center">
        {result.thumbnailDataUrl ? (
          <img src={result.thumbnailDataUrl} alt="Recording preview" className="w-full h-full object-cover" />
        ) : (
          <FileVideo size={40} className="text-bear-muted" />
        )}
      </div>

      {/* Info */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-bear-text">Recording saved!</h2>
        <p className="text-bear-muted text-sm mt-1 truncate max-w-xs">{fileName}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-bear-muted">
          <span>{formatSize(result.fileSizeBytes)}</span>
          <span className="w-1 h-1 rounded-full bg-bear-border" />
          <span>{formatDuration(result.durationMs)}</span>
        </div>
      </div>

      {/* FTP Upload Status */}
      {ftp.enabled && (
        <div className="w-full max-w-xs">
          {uploadStatus === 'uploading' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-bear-muted">
                <Loader size={14} className="animate-spin" />
                <span>Uploading to FTP... {uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-bear-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-bear-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {uploadStatus === 'success' && uploadUrl && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle size={14} />
                <span>Uploaded successfully!</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={uploadUrl}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-lg border border-bear-border bg-bear-surface text-xs text-bear-text truncate"
                />
                <button
                  onClick={copyUrl}
                  className="px-3 py-2 rounded-lg border border-bear-border text-bear-muted hover:text-bear-text hover:border-bear-muted transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}
          {uploadStatus === 'error' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <XCircle size={14} />
                <span>Upload failed</span>
              </div>
              <p className="text-xs text-bear-muted">{uploadError}</p>
              <button
                onClick={startUpload}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-bear-border text-bear-muted hover:text-bear-text hover:border-bear-muted text-sm transition-colors"
              >
                <Upload size={14} /> Retry upload
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={() => window.electronAPI.openFile(result.outputPath)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-bear-accent hover:bg-bear-accent-hover text-white font-medium text-sm transition-all active:scale-95"
        >
          <FileVideo size={16} /> Open file
        </button>
        <button
          onClick={() => window.electronAPI.openFolder(folder)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-bear-border text-bear-muted hover:text-bear-text hover:border-bear-muted text-sm transition-colors"
        >
          <FolderOpen size={16} /> Open folder
        </button>
        <button
          onClick={onRecordAgain}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-bear-muted hover:text-bear-text text-sm transition-colors"
        >
          <RotateCcw size={14} /> Record again
        </button>
      </div>
    </div>
  )
}
