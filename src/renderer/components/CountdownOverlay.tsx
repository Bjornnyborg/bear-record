import React, { useState, useEffect } from 'react'

export default function CountdownOverlay() {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) return
    const t = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count])

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bear-bg/90 z-50">
      <div className="flex flex-col items-center gap-4">
        <div
          key={count}
          className="text-9xl font-black text-bear-accent"
          style={{
            animation: 'countPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            lineHeight: 1
          }}
        >
          {count === 0 ? '🎬' : count}
        </div>
        <p className="text-bear-muted text-lg tracking-widest uppercase">
          {count === 0 ? 'Recording...' : 'Starting in'}
        </p>
      </div>
      <style>{`
        @keyframes countPop {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
