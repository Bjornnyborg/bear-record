import React from 'react'

interface Props {
  progress: number
}

export default function ProcessingScreen({ progress }: Props) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-12">
      <div className="w-16 h-16 rounded-full border-4 border-bear-border border-t-bear-accent animate-spin" />
      <div className="text-center">
        <h2 className="text-xl font-semibold text-bear-text">Processing recording</h2>
        <p className="text-bear-muted text-sm mt-1">Converting to MP4…</p>
      </div>
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-xs text-bear-muted mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-bear-border rounded-full overflow-hidden">
          <div
            className="h-full bg-bear-accent rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
