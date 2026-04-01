import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, createWriteStream, WriteStream, unlinkSync, existsSync } from 'fs'

// --- screen session ---
let sessionPath: string | null = null
let writeStream: WriteStream | null = null
let pendingWrites = 0
let endResolve: ((path: string) => void) | null = null
let endReject: ((err: Error) => void) | null = null
let ending = false

// --- webcam session ---
let webcamPath: string | null = null
let webcamStream: WriteStream | null = null
let webcamPending = 0
let webcamEndResolve: ((path: string) => void) | null = null
let webcamEndReject: ((err: Error) => void) | null = null
let webcamEnding = false

function getTempDir(): string {
  const dir = join(app.getPath('temp'), 'bear-record')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function startSession(): string {
  const dir = getTempDir()
  sessionPath = join(dir, `recording-${Date.now()}.webm`)
  writeStream = createWriteStream(sessionPath)
  pendingWrites = 0
  ending = false
  endResolve = null
  endReject = null
  return sessionPath
}

export function writeChunk(buffer: Buffer): void {
  if (!writeStream || ending) return
  pendingWrites++
  const ok = writeStream.write(buffer, (err) => {
    pendingWrites--
    if (err) {
      endReject?.(err)
      return
    }
    // If endSession was called and this was the last pending write, close now
    if (ending && pendingWrites === 0) {
      flushAndClose()
    }
  })
}

function flushAndClose() {
  if (!writeStream || !sessionPath) return
  const path = sessionPath
  const resolve = endResolve
  writeStream.end(() => {
    writeStream = null
    resolve?.(path)
  })
}

export function endSession(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!writeStream || !sessionPath) {
      reject(new Error('No active session'))
      return
    }
    endResolve = resolve
    endReject = reject
    ending = true

    if (pendingWrites === 0) {
      // All chunks already written — close immediately
      flushAndClose()
    }
    // Otherwise flushAndClose() will be called by the last writeChunk callback
  })
}

export function cleanupSession(): void {
  if (sessionPath && existsSync(sessionPath)) {
    try { unlinkSync(sessionPath) } catch { /* ignore */ }
  }
  sessionPath = null
  writeStream = null
  pendingWrites = 0
  ending = false
  endResolve = null
  endReject = null
}

// Webcam session
export function startWebcamSession(): string {
  const dir = getTempDir()
  webcamPath = join(dir, `webcam-${Date.now()}.webm`)
  webcamStream = createWriteStream(webcamPath)
  webcamPending = 0
  webcamEnding = false
  webcamEndResolve = null
  webcamEndReject = null
  return webcamPath
}

export function writeWebcamChunk(buffer: Buffer): void {
  if (!webcamStream || webcamEnding) return
  webcamPending++
  webcamStream.write(buffer, (err) => {
    webcamPending--
    if (err) { webcamEndReject?.(err); return }
    if (webcamEnding && webcamPending === 0) flushAndCloseWebcam()
  })
}

function flushAndCloseWebcam() {
  if (!webcamStream || !webcamPath) return
  const path = webcamPath
  const resolve = webcamEndResolve
  webcamStream.end(() => { webcamStream = null; resolve?.(path) })
}

export function endWebcamSession(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!webcamStream || !webcamPath) { reject(new Error('No webcam session')); return }
    webcamEndResolve = resolve
    webcamEndReject = reject
    webcamEnding = true
    if (webcamPending === 0) flushAndCloseWebcam()
  })
}

export function cleanupWebcamSession(): void {
  if (webcamPath && existsSync(webcamPath)) {
    try { unlinkSync(webcamPath) } catch { /* ignore */ }
  }
  webcamPath = null
  webcamStream = null
  webcamPending = 0
  webcamEnding = false
  webcamEndResolve = null
  webcamEndReject = null
}

export function getOutputPath(outputFolder: string, filenamePrefix: string = 'BearRecord'): string {
  mkdirSync(outputFolder, { recursive: true })
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  const prefix = filenamePrefix.trim() || 'BearRecord'
  return join(outputFolder, `${prefix}-${ts}.mp4`)
}
