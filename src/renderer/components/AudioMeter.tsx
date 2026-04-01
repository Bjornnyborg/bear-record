import React from 'react'

interface Props {
  level: number // 0–1
  enabled: boolean
}

export default function AudioMeter({ level, enabled }: Props) {
  const bars = 12
  const active = Math.round(level * bars)
  return (
    <div className="flex items-end gap-0.5 h-5">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm transition-colors duration-75"
          style={{
            height: `${30 + (i / bars) * 70}%`,
            backgroundColor:
              !enabled
                ? '#2a2a2a'
                : i < active
                ? i < bars * 0.6
                  ? '#4ade80'
                  : i < bars * 0.85
                  ? '#facc15'
                  : '#f87171'
                : '#2a2a2a'
          }}
        />
      ))}
    </div>
  )
}
