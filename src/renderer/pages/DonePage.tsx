import React from 'react'
import { FolderOpen, FileVideo, RotateCcw } from 'lucide-react'
import type { TranscodeResult } from '../../shared/types'

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

export default function DonePage({ result, onRecordAgain }: Props) {
  const fileName = result.outputPath.split(/[\\/]/).pop() ?? 'recording.mp4'
  const folder = result.outputPath.split(/[\\/]/).slice(0, -1).join('/')

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
