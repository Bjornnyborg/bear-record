import { useState, useRef, useCallback, useEffect } from 'react'
import type { TranscodeResult } from '../../shared/types'
import { useSettingsStore } from '../store/settingsStore'

type RecordingState = 'settings' | 'countdown' | 'recording' | 'processing' | 'done'

export function useRecording() {
  const [state, setState] = useState<RecordingState>('settings')
  const [progress, setProgress] = useState(0)
  const [transcodeResult, setTranscodeResult] = useState<TranscodeResult | null>(null)

  const screenMrRef = useRef<MediaRecorder | null>(null)
  const webcamMrRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const videoSizeRef = useRef<{ w: number; h: number } | null>(null)
  const webcamPathRef = useRef<string | null>(null)
  const recordingStartTimeRef = useRef<number>(0)

  const getSettings = useSettingsStore.getState

  useEffect(() => {
    const removeStop = window.electronAPI.onHudStop(() => stopRecording())
    const removePause = window.electronAPI.onHudPause((paused) => {
      const mr = screenMrRef.current
      if (!mr || mr.state === 'inactive') return
      if (paused && mr.state === 'recording') {
        mr.pause()
        webcamMrRef.current?.pause()
      }
      if (!paused && mr.state === 'paused') {
        mr.resume()
        webcamMrRef.current?.resume()
      }
    })
    return () => { removeStop(); removePause() }
  }, [])

  const startCountdown = useCallback(() => {
    setState('countdown')
    setTimeout(() => startRecording(), 3000)
  }, [])

  async function startRecording() {
    const settings = getSettings()

    try {
      // Stop any border tracking and hide border before capture
      await window.electronAPI.invoke('border:stopTracking')
      await window.electronAPI.invoke('border:hide')
      
      // Move window off-screen
      window.electronAPI.hideWindow()
      
      // Small delay to let resources release
      await new Promise((r) => setTimeout(r, 50))
      
      await window.electronAPI.invoke('recording:start')

      const captureTarget = settings.captureTarget
      if (!captureTarget) throw new Error('No capture target selected')
      
      // Focus the target window if recording a window
      if (captureTarget.kind === 'window') {
        await window.electronAPI.invoke('window:focus', captureTarget.sourceId)
        await new Promise((r) => setTimeout(r, 50)) // Let window come to foreground
      }

      const nativeW = Math.round(window.screen.width * window.devicePixelRatio)
      const nativeH = Math.round(window.screen.height * window.devicePixelRatio)

      // For window captures, don't force dimensions - let Electron use the window's actual size
      const videoConstraints: any = {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: captureTarget.sourceId,
        }
      }
      
      // Only force dimensions for fullscreen/region captures (screen source)
      if (captureTarget.kind !== 'window') {
        videoConstraints.mandatory.minWidth = nativeW
        videoConstraints.mandatory.maxWidth = nativeW
        videoConstraints.mandatory.minHeight = nativeH
        videoConstraints.mandatory.maxHeight = nativeH
      }

      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: settings.audio.systemEnabled
          ? ({ mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: captureTarget.sourceId } } as any)
          : false,
        video: videoConstraints
      })
      screenStreamRef.current = screenStream

      const vs = screenStream.getVideoTracks()[0].getSettings()
      videoSizeRef.current = { w: vs.width ?? nativeW, h: vs.height ?? nativeH }
      console.log('[bear] screen size:', videoSizeRef.current)

      // Mic
      let micStream: MediaStream | null = null
      if (settings.audio.micEnabled) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: settings.audio.micDeviceId ? { deviceId: { exact: settings.audio.micDeviceId } } : true,
            video: false
          })
          micStreamRef.current = micStream
        } catch (err) { console.warn('[bear] mic unavailable:', err) }
      }

      // Webcam — recorded to a separate file, composited by FFmpeg
      let webcamStream: MediaStream | null = null
      if (settings.webcam.enabled) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: settings.webcam.deviceId ? { deviceId: { exact: settings.webcam.deviceId } } : true,
            audio: false
          })
          webcamStreamRef.current = webcamStream
          await window.electronAPI.startWebcamSession()
          console.log('[bear] webcam acquired')
        } catch (err) { console.warn('[bear] webcam unavailable:', err) }
      }

      // Merge audio: mic + system
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const dest = audioCtx.createMediaStreamDestination()
      if (micStream) audioCtx.createMediaStreamSource(micStream).connect(dest)
      const sysAudioTracks = screenStream.getAudioTracks()
      if (sysAudioTracks.length > 0) {
        audioCtx.createMediaStreamSource(new MediaStream(sysAudioTracks)).connect(dest)
      }

      // Screen MediaRecorder — video + merged audio
      const screenRecord = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ])
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus' : 'video/webm'

      const screenMr = new MediaRecorder(screenRecord, { mimeType })
      screenMrRef.current = screenMr

      const screenPending: Promise<void>[] = []
      screenMr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          screenPending.push(e.data.arrayBuffer().then((b) => window.electronAPI.sendChunk(b)))
        }
      }

      // Webcam MediaRecorder — video only, separate file
      let webcamMr: MediaRecorder | null = null
      const webcamPending: Promise<void>[] = []
      if (webcamStream) {
        webcamMr = new MediaRecorder(webcamStream, { mimeType: 'video/webm;codecs=vp8' })
        webcamMrRef.current = webcamMr
        webcamMr.ondataavailable = (e) => {
          if (e.data.size > 0) {
            webcamPending.push(e.data.arrayBuffer().then((b) => window.electronAPI.sendWebcamChunk(b)))
          }
        }
      }

      screenMr.onstop = async () => {
        stopAllStreams()
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        await Promise.all(screenPending)
        await Promise.all(webcamPending)
        await window.electronAPI.closeHud()
        await window.electronAPI.invoke('border:hide')
        await window.electronAPI.showWindow()
        setState('processing')
        await doTranscode(!!webcamStream)
      }

      // Start both recorders simultaneously
      recordingStartTimeRef.current = Date.now()
      screenMr.start(250)
      webcamMr?.start(250)

      setState('recording')

      // Show HUD and border immediately - they use setContentProtection(true) 
      // so they're visible to user but excluded from capture
      const webcamDeviceId = settings.webcam.enabled ? (settings.webcam.deviceId ?? '') : ''
      
      // Determine capture area for HUD positioning
      let captureArea: { x: number; y: number; width: number; height: number } | undefined
      if (captureTarget.kind === 'region') {
        captureArea = captureTarget.region
      } else if (captureTarget.kind === 'fullscreen') {
        // Get the display bounds for the selected screen
        const bounds = await window.electronAPI.invoke('display:getBounds', captureTarget.sourceId)
        if (bounds) captureArea = bounds
      }
      // For window captures, we could track window position but it moves - leave undefined
      
      await window.electronAPI.invoke('hud:open', webcamDeviceId, captureArea)
      
      if (captureTarget.kind === 'region') {
        const r = captureTarget.region
        await window.electronAPI.invoke('border:show', r.x, r.y, r.width, r.height)
      } else if (captureTarget.kind === 'window') {
        // For window capture, track the window and update border position
        await window.electronAPI.invoke('border:show', 0, 0, 100, 100)
        await window.electronAPI.invoke('border:trackWindow', captureTarget.sourceId)
      } else {
        // Fullscreen - pass sourceId to show border on correct screen
        await window.electronAPI.invoke('border:showFullscreen', captureTarget.sourceId)
      }

    } catch (err) {
      console.error('[bear] Recording failed:', err)
      await window.electronAPI.showWindow()
      setState('settings')
    }
  }

  function stopAllStreams() {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    webcamStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    micStreamRef.current = null
    webcamStreamRef.current = null
  }

  const stopRecording = useCallback(() => {
    const smr = screenMrRef.current
    const wmr = webcamMrRef.current
    // Stop webcam first so it finishes before screen onstop runs doTranscode
    if (wmr && wmr.state !== 'inactive') wmr.stop()
    if (smr && smr.state !== 'inactive') smr.stop()
  }, [])

  async function doTranscode(hasWebcam: boolean) {
    const settings = getSettings()
    setProgress(0)
    const removeProgress = window.electronAPI.onTranscodeProgress((pct) => setProgress(pct))

    // Calculate recording duration for progress tracking
    const recordingDurationSec = Math.max(1, (Date.now() - recordingStartTimeRef.current) / 1000)

    try {
      const inputPath = await window.electronAPI.stopRecording()
      const webcamPath = hasWebcam ? await window.electronAPI.stopWebcamSession() : null
      const outputPath = await window.electronAPI.invoke('recording:outputPath', settings.outputFolder, settings.filenamePrefix)

      const result = await window.electronAPI.transcode({
        inputPath,
        webcamPath,
        outputPath,
        quality: settings.quality,
        recordingDurationSec,
        region: (() => {
          if (settings.captureTarget?.kind !== 'region') return null
          const r = settings.captureTarget.region
          const vid = videoSizeRef.current
          if (!vid) return null

          const dpr = window.devicePixelRatio ?? 1
          const x = Math.round(r.x * dpr)
          const y = Math.round(r.y * dpr)
          const w = Math.round(r.width * dpr)
          const h = Math.round(r.height * dpr)

          const cx = Math.max(0, Math.min(x, vid.w - 2))
          const cy = Math.max(0, Math.min(y, vid.h - 2))
          const cw = Math.min(w, vid.w - cx)
          const ch = Math.min(h, vid.h - cy)

          console.log('[bear] region:', { cx, cy, cw, ch }, 'video:', vid)

          return {
            x: cx, y: cy,
            width: cw % 2 === 0 ? cw : cw - 1,
            height: ch % 2 === 0 ? ch : ch - 1
          }
        })()
      })

      setTranscodeResult(result as TranscodeResult)
      setState('done')
    } catch (err) {
      console.error('[bear] Transcode failed:', err)
      setState('settings')
    } finally {
      removeProgress()
    }
  }

  return { state, progress, transcodeResult, startCountdown, stopRecording }
}
