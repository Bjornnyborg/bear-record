import { useState, useEffect, useCallback } from 'react'

export interface CameraDevice { deviceId: string; label: string }

export function useWebcam(enabled: boolean, deviceId: string | null) {
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)

  const enumerateDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices(
      all
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` }))
    )
  }, [])

  useEffect(() => { enumerateDevices() }, [enumerateDevices])

  const requestPermission = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      s.getTracks().forEach((t) => t.stop())
      await enumerateDevices()
    } catch {
      // Permission denied — nothing to do
    }
  }, [enumerateDevices])

  useEffect(() => {
    if (!enabled) {
      stream?.getTracks().forEach((t) => t.stop())
      setStream(null)
      return
    }
    let stopped = false
    navigator.mediaDevices
      .getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return }
        setStream(s)
      })
      .catch(() => setStream(null))
    return () => {
      stopped = true
      setStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null })
    }
  }, [enabled, deviceId])

  return { devices, stream, requestPermission }
}
