import React, { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream | null
}

export default function WebcamPreview({ stream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  if (!stream) {
    return (
      <div className="w-24 h-18 rounded-lg bg-bear-border flex items-center justify-center text-bear-muted text-xs">
        No cam
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-24 h-18 rounded-lg object-cover border border-bear-border"
      style={{ height: '4.5rem' }}
    />
  )
}
