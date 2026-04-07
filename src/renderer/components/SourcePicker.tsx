import React, { useState, useEffect } from 'react'
import type { CaptureTarget } from '../../shared/types'
import { useMediaSources } from '../hooks/useMediaSources'
import { Monitor, AppWindow, Crosshair, RefreshCw, ShieldAlert } from 'lucide-react'

interface Props {
  selected: CaptureTarget | null
  onSelect: (t: CaptureTarget) => void
}

export default function SourcePicker({ selected, onSelect }: Props) {
  const { sources, loading, refresh } = useMediaSources()
  const [tab, setTab] = useState<'screen' | 'window'>('screen')

  const screens = sources.filter((s) => s.type === 'screen')
  const windows = sources.filter((s) => s.type === 'window')
  const list = tab === 'screen' ? screens : windows

  // Show a preview border whenever a source is selected
  useEffect(() => {
    if (!selected) {
      window.electronAPI.invoke('border:hide')
      return
    }

    if (selected.kind === 'region') {
      const r = selected.region
      window.electronAPI.invoke('border:show', r.x, r.y, r.width, r.height)
    } else if (selected.kind === 'window') {
      // Track window and show border when bounds are received
      // Don't show placeholder - wait for real bounds from tracking
      window.electronAPI.invoke('border:trackWindow', selected.sourceId)
    } else {
      // Fullscreen - show border around the selected screen
      window.electronAPI.invoke('border:showFullscreen', selected.sourceId)
    }

    return () => {
      window.electronAPI.invoke('border:stopTracking')
      window.electronAPI.invoke('border:hide')
    }
  }, [selected?.kind, selected?.sourceId, selected?.kind === 'region' ? JSON.stringify(selected.region) : null])

  const handleSourceClick = (kind: 'fullscreen' | 'window', sourceId: string, sourceName: string) => {
    onSelect({ kind, sourceId, sourceName })
  }

  const selectRegion = async () => {
    // Hide any existing border while selecting
    await window.electronAPI.invoke('border:hide')
    const region = await window.electronAPI.selectRegion()
    if (region) {
      const sourceId = selected?.sourceId ?? screens[0]?.id ?? ''
      const sourceName = selected?.sourceName ?? screens[0]?.name ?? 'Screen'
      onSelect({ kind: 'region', sourceId, sourceName, region })
      // Border will appear via the useEffect above
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-bear-border rounded-lg p-1">
          <button
            onClick={() => setTab('screen')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors ${tab === 'screen' ? 'bg-bear-surface text-bear-text' : 'text-bear-muted hover:text-bear-text'}`}
          >
            <Monitor size={14} /> Screen
          </button>
          <button
            onClick={() => setTab('window')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors ${tab === 'window' ? 'bg-bear-surface text-bear-text' : 'text-bear-muted hover:text-bear-text'}`}
          >
            <AppWindow size={14} /> Window
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectRegion}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-bear-border text-bear-muted hover:text-bear-text hover:border-bear-accent transition-colors"
          >
            <Crosshair size={13} /> Select region
          </button>
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg border border-bear-border text-bear-muted hover:text-bear-text transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-bear-border border-t-bear-accent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
          {list.map((src) => {
            const isSelected = selected?.sourceId === src.id
            return (
              <button
                key={src.id}
                onClick={() => handleSourceClick(tab === 'screen' ? 'fullscreen' : 'window', src.id, src.name)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                  isSelected ? 'border-bear-accent' : 'border-bear-border hover:border-bear-muted'
                }`}
              >
                <img
                  src={src.thumbnailDataUrl}
                  alt={src.name}
                  className="w-full aspect-video object-cover bg-bear-border"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                  <span className="text-xs text-bear-text truncate block">{src.name}</span>
                </div>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-bear-accent flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            )
          })}
          {list.length === 0 && tab === 'screen' && !loading && (
            <div className="col-span-3 flex flex-col items-center gap-2 py-6">
              <p className="text-bear-muted text-sm">No screens found</p>
              <button
                onClick={() => window.electronAPI.openPermissionSettings('screen')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <ShieldAlert size={13} /> Check permissions
              </button>
            </div>
          )}
          {list.length === 0 && tab === 'window' && !loading && (
            <div className="col-span-3 text-center py-6 text-bear-muted text-sm">
              No windows found
            </div>
          )}
        </div>
      )}

      {selected && (
        <p className="text-xs text-bear-muted">
          Recording: <span className="text-bear-text">{selected.sourceName}</span>
          {selected.kind === 'region' && (
            <span className="text-bear-accent ml-2">
              {selected.region.width}×{selected.region.height} region
            </span>
          )}
        </p>
      )}
    </div>
  )
}
