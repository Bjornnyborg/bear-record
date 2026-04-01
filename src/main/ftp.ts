import { Client } from 'basic-ftp'
import { createReadStream, statSync } from 'fs'
import { basename } from 'path'
import type { FtpSettings } from '../shared/types'

export interface UploadProgress {
  bytesTransferred: number
  totalBytes: number
  percent: number
}

export interface UploadResult {
  success: boolean
  url: string
  error?: string
}

export async function uploadToFtp(
  filePath: string,
  settings: FtpSettings,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const client = new Client()
  client.ftp.verbose = false

  const fileName = basename(filePath)
  const fileSize = statSync(filePath).size
  const remotePath = settings.remotePath.endsWith('/')
    ? settings.remotePath + fileName
    : settings.remotePath + '/' + fileName

  try {
    await client.access({
      host: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password,
      secure: false // Set to true or 'implicit' for FTPS
    })

    // Track upload progress
    client.trackProgress((info) => {
      if (onProgress && info.bytes > 0) {
        onProgress({
          bytesTransferred: info.bytes,
          totalBytes: fileSize,
          percent: Math.min((info.bytes / fileSize) * 100, 100)
        })
      }
    })

    // Upload the file
    await client.uploadFrom(filePath, remotePath)

    // Generate final URL
    const url = settings.urlTemplate
      ? settings.urlTemplate.replace('{filename}', fileName)
      : ''

    return { success: true, url }
  } catch (err: any) {
    console.error('[ftp] Upload failed:', err)
    return {
      success: false,
      url: '',
      error: err.message || 'Upload failed'
    }
  } finally {
    client.trackProgress() // Stop tracking
    client.close()
  }
}

export async function testFtpConnection(settings: FtpSettings): Promise<{ success: boolean; error?: string }> {
  const client = new Client()
  client.ftp.verbose = false

  try {
    await client.access({
      host: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password,
      secure: false
    })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Connection failed' }
  } finally {
    client.close()
  }
}
