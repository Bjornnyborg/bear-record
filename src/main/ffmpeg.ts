import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'
import ffmpegStatic from 'ffmpeg-static'
import Ffmpeg from 'fluent-ffmpeg'
import type { QualityPreset, Region, TranscodeResult } from '../shared/types'
import { app } from 'electron'
import { mkdirSync, statSync } from 'fs'

function resolveFfmpegPath(): string {
  const resourcePath = join(process.resourcesPath || '', 'ffmpeg-static')
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const packedPath = join(resourcePath, binName)
  console.log('[ffmpeg] Checking packed path:', packedPath, 'exists:', existsSync(packedPath))
  if (existsSync(packedPath)) return packedPath
  console.log('[ffmpeg] Checking ffmpegStatic:', ffmpegStatic, 'exists:', ffmpegStatic ? existsSync(ffmpegStatic) : false)
  if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic
  throw new Error(`FFmpeg binary not found. Checked: ${packedPath}, ${ffmpegStatic}`)
}

const QUALITY_FLAGS: Record<QualityPreset, { crf: number; preset: string; audioBitrate: string }> = {
  good:    { crf: 28, preset: 'ultrafast', audioBitrate: '128k' },
  high:    { crf: 23, preset: 'veryfast',  audioBitrate: '192k' },
  maximum: { crf: 18, preset: 'fast',      audioBitrate: '320k' }
}

export async function transcode(
  inputPath: string,
  webcamPath: string | null,
  outputPath: string,
  quality: QualityPreset,
  region: Region | null,
  recordingDurationSec: number,
  onProgress: (pct: number) => void
): Promise<TranscodeResult> {
  console.log('[ffmpeg] Starting transcode:', { inputPath, webcamPath, outputPath, quality })
  
  let ffmpegPath: string
  try {
    ffmpegPath = resolveFfmpegPath()
    console.log('[ffmpeg] Using ffmpeg at:', ffmpegPath)
  } catch (err) {
    console.error('[ffmpeg] Failed to resolve ffmpeg path:', err)
    throw err
  }
  
  Ffmpeg.setFfmpegPath(ffmpegPath)
  const { crf, preset, audioBitrate } = QUALITY_FLAGS[quality]
  const start = Date.now()
  const thumbPath = outputPath.replace('.mp4', '-thumb.jpg')

  // Ensure output folder exists
  mkdirSync(dirname(outputPath), { recursive: true })

  return new Promise((resolve, reject) => {
    const cmd = Ffmpeg(inputPath)
      .inputOptions(['-fflags', '+genpts'])

    if (webcamPath && existsSync(webcamPath)) {
      cmd.input(webcamPath)
    }

    // Build the video filter chain
    // Filters: optional crop → optional webcam circle PiP overlay
    const hasWebcam = !!(webcamPath && existsSync(webcamPath))
    const filterParts: string[] = []

    // Step 1: crop screen if region selected
    if (region) {
      filterParts.push(`[0:v]crop=${region.width}:${region.height}:${region.x}:${region.y}[cropped]`)
    }
    const screenLabel = region ? '[cropped]' : '[0:v]'

    if (hasWebcam) {
      // Step 2: scale webcam to PiP size, create circular mask, overlay bottom-left
      // PiP diameter = 50% of min(W,H). Use scale2ref to size webcam relative to screen.
      // Crop webcam to square first (center crop) so it fills the circle proportionally
      filterParts.push(
        // Center-crop webcam to square (aspect-fill behavior)
        `[1:v]crop=w='min(iw\\,ih)':h='min(iw\\,ih)'[wcsq]`,
        // Scale the square webcam to PiP size using scale2ref
        `[wcsq]${screenLabel}scale2ref=w='round(min(main_w\\,main_h)*0.50)':h='round(min(main_w\\,main_h)*0.50)'[wcscaled][screenref]`,
        // Create circular mask using geq - lte() returns 0/1, multiply by 255 for alpha
        `[wcscaled]format=yuva420p,geq=lum='p(X,Y)':a='255*lte(pow(X-W/2\\,2)+pow(Y-H/2\\,2)\\,pow(W/2\\,2))'[wccirc]`,
        // Overlay: position = small margin from bottom-left (3% of min dimension)
        `[screenref][wccirc]overlay=x='round(min(W\\,H)*0.03)':y='H-round(min(W\\,H)*0.03)-h'[out]`
      )
    }

    const outputOptions: string[] = [
      `-crf ${crf}`,
      `-preset ${preset}`,
      '-movflags +faststart',
      '-pix_fmt yuv420p',
      '-threads 0',
      '-r 30'
    ]

    if (hasWebcam) {
      outputOptions.push('-map [out]', '-map 0:a?')
    } else if (region) {
      outputOptions.push('-map [cropped]', '-map 0:a?')
    }

    if (filterParts.length > 0) {
      cmd.complexFilter(filterParts.join(';'))
    }

    // Parse timemark (HH:MM:SS.ss or MM:SS.ss) to seconds
    const parseTimemark = (tm: string): number => {
      const parts = tm.split(':').map(Number)
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
      if (parts.length === 2) return parts[0] * 60 + parts[1]
      return parts[0] || 0
    }

    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate(audioBitrate)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('progress', (info) => {
        // Use timemark for progress calculation (more reliable than percent for webm input)
        if (info.timemark && recordingDurationSec > 0) {
          const currentSec = parseTimemark(info.timemark)
          const pct = Math.min((currentSec / recordingDurationSec) * 100, 99)
          onProgress(pct)
        } else if (info.percent != null && !isNaN(info.percent)) {
          onProgress(Math.min(info.percent, 99))
        }
      })
      .on('end', () => {
        const durationMs = Date.now() - start
        const fileSizeBytes = statSync(outputPath).size

        // Extract thumbnail
        Ffmpeg(outputPath)
          .setFfmpegPath(ffmpegPath)
          .screenshots({
            count: 1,
            folder: dirname(outputPath),
            filename: basename(thumbPath),
            size: '640x?'
          })
          .on('end', () => {
            const { readFileSync, unlinkSync: rm } = require('fs')
            let thumbnailDataUrl = ''
            try {
              thumbnailDataUrl = 'data:image/jpeg;base64,' + readFileSync(thumbPath).toString('base64')
              rm(thumbPath)
            } catch { /* optional */ }
            resolve({ outputPath, durationMs, fileSizeBytes, thumbnailDataUrl })
          })
          .on('error', () => resolve({ outputPath, durationMs, fileSizeBytes, thumbnailDataUrl: '' }))
      })
      .on('stderr', (line) => console.log('[ffmpeg]', line))
      .on('error', (err, _stdout, stderr) => {
        console.error('[ffmpeg] Transcode error:', err)
        console.error('[ffmpeg] stderr:', stderr)
        const detail = stderr ? stderr.split('\n').filter(Boolean).slice(-5).join(' | ') : err.message
        reject(new Error(`FFmpeg failed: ${detail}`))
      })
      .run()
  })
}
