import { useState, useEffect, useRef } from 'react'

export interface MicDevice { deviceId: string; label: string }

export function useAudioMixer(micEnabled: boolean, micDeviceId: string | null) {
  const [devices, setDevices] = useState<MicDevice[]>([])
  const [level, setLevel] = useState(0)
  const animRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      setDevices(
        all
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}` }))
      )
    })
  }, [])

  useEffect(() => {
    if (!micEnabled) {
      cleanup()
      return
    }

    let stopped = false
    navigator.mediaDevices
      .getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
        video: false
      })
      .then((stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser

        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length
          setLevel(avg / 128)
          animRef.current = requestAnimationFrame(tick)
        }
        animRef.current = requestAnimationFrame(tick)
      })
      .catch(() => {})

    return () => { stopped = true; cleanup() }
  }, [micEnabled, micDeviceId])

  function cleanup() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    setLevel(0)
  }

  return { devices, level }
}
