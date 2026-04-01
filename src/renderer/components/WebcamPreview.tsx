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
      <div className="w-28 h-28 rounded-full bg-bear-border flex items-center justify-center text-bear-muted text-xs">
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
      className="w-28 h-28 rounded-full object-cover border-2 border-bear-border"
    />
  )
}
