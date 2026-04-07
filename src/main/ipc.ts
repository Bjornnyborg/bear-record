import { ipcMain, BrowserWindow, dialog, shell, app, clipboard } from 'electron'
import Store from 'electron-store'
import { IPC, DEFAULT_SETTINGS } from '../shared/types'
import type { AppSettings, TranscodeRequest, FtpSettings } from '../shared/types'
import { getCaptureSources } from './sources'
import { startSession, writeChunk, endSession, getOutputPath, startWebcamSession, writeWebcamChunk, endWebcamSession } from './temp'
import { transcode } from './ffmpeg'
import { uploadToFtp, testFtpConnection } from './ftp'
import { createHudWindow, closeHudWindow, createRegionWindow, createBorderWindow, createFullscreenBorderWindow, closeBorderWindow, updateBorderWindow, registerRecordingShortcuts, unregisterRecordingShortcuts } from './main'
import { startWindowTracking, stopWindowTracking, focusWindow } from './windowTracker'
import { join } from 'path'

const store = new Store<{ settings: AppSettings }>({
  defaults: { settings: DEFAULT_SETTINGS }
})

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // Desktop sources
  ipcMain.handle(IPC.SOURCES_GET, () => getCaptureSources())

  // Region selection
  ipcMain.handle(IPC.REGION_SELECT, async () => {
    const region = await createRegionWindow()
    return region
  })

  // Recording chunks — arrives as Uint8Array (Electron serializes typed arrays correctly)
  ipcMain.on(IPC.RECORDING_CHUNK, (_e, buffer: Uint8Array) => {
    writeChunk(Buffer.from(buffer))
  })
  ipcMain.on('webcam:chunk', (_e, buffer: Uint8Array) => {
    writeWebcamChunk(Buffer.from(buffer))
  })
  ipcMain.handle('webcam:start', () => startWebcamSession())
  ipcMain.handle('webcam:stop', () => endWebcamSession())

  // Start recording session — returns temp file path
  ipcMain.handle('recording:start', () => {
    registerRecordingShortcuts()
    return startSession()
  })

  // Stop recording — flush write stream and return temp path
  ipcMain.handle(IPC.RECORDING_STOP, async () => {
    unregisterRecordingShortcuts()
    return endSession()
  })

  // Transcode
  ipcMain.handle(IPC.RECORDING_TRANSCODE, async (event, req: TranscodeRequest) => {
    const result = await transcode(
      req.inputPath,
      req.webcamPath ?? null,
      req.outputPath,
      req.quality,
      req.region,
      req.recordingDurationSec ?? 0,
      (pct) => event.sender.send(IPC.TRANSCODE_PROGRESS, pct)
    )
    event.sender.send(IPC.TRANSCODE_PROGRESS, 100)
    return result
  })

  // Settings
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    const s = store.get('settings', DEFAULT_SETTINGS)
    if (!s.outputFolder) {
      s.outputFolder = join(app.getPath('videos'), 'BearRecord')
    }
    return s
  })
  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<AppSettings>) => {
    const current = store.get('settings', DEFAULT_SETTINGS)
    store.set('settings', { ...current, ...patch })
  })

  // FTP Upload
  ipcMain.handle(IPC.FTP_UPLOAD, async (event, filePath: string, ftpSettings: FtpSettings) => {
    const result = await uploadToFtp(filePath, ftpSettings, (progress) => {
      event.sender.send(IPC.FTP_UPLOAD_PROGRESS, progress)
    })
    return result
  })
  
  ipcMain.handle(IPC.FTP_TEST, async (_e, ftpSettings: FtpSettings) => {
    return testFtpConnection(ftpSettings)
  })

  // Output path helper
  ipcMain.handle('recording:outputPath', (_e, outputFolder: string, filenamePrefix?: string) => {
    return getOutputPath(outputFolder, filenamePrefix)
  })

  // Shell
  ipcMain.handle(IPC.SHELL_OPEN_FILE, (_e, path: string) => shell.openPath(path))
  ipcMain.handle(IPC.SHELL_OPEN_FOLDER, (_e, path: string) => shell.openPath(path))
  ipcMain.handle('shell:openPermissionSettings', (_e, type: 'screen' | 'camera') => {
    if (process.platform === 'win32') {
      const url = type === 'camera'
        ? 'ms-settings:privacy-webcam'
        : 'ms-settings:privacy-broadfilesystemaccess'
      shell.openExternal(url)
    } else if (process.platform === 'darwin') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy')
    }
  })

  // Clipboard
  ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text))
  ipcMain.handle(IPC.SHOW_FOLDER_PICKER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // HUD window management
  ipcMain.handle(IPC.HUD_OPEN, (_e, webcamDeviceId?: string, captureArea?: { x: number; y: number; width: number; height: number }) => 
    createHudWindow(webcamDeviceId, captureArea))
  ipcMain.handle(IPC.HUD_CLOSE, () => closeHudWindow())

  // Recording border overlay
  ipcMain.handle('border:show', (_e, x: number, y: number, w: number, h: number) =>
    createBorderWindow(x, y, w, h))
  ipcMain.handle('border:showFullscreen', (_e, sourceId?: string) => createFullscreenBorderWindow(sourceId))
  ipcMain.handle('border:hide', () => {
    stopWindowTracking()
    closeBorderWindow()
  })

  // Window tracking for border overlay
  ipcMain.handle('border:trackWindow', (_e, sourceId: string) => {
    console.log('[border] Starting window tracking for:', sourceId)
    return startWindowTracking(sourceId, (bounds) => {
      if (bounds) {
        console.log('[border] Window bounds:', bounds)
        updateBorderWindow(bounds.x, bounds.y, bounds.width, bounds.height)
      } else {
        console.log('[border] Could not get window bounds')
      }
    })
  })
  ipcMain.handle('border:stopTracking', () => stopWindowTracking())
  
  // Focus window
  ipcMain.handle('window:focus', (_e, sourceId: string) => focusWindow(sourceId))
  
  // Get display bounds for a screen sourceId
  ipcMain.handle('display:getBounds', (_e, sourceId: string) => {
    const { screen } = require('electron')
    const match = sourceId.match(/^screen:(\d+):/)
    if (!match) return null
    const displayIndex = parseInt(match[1], 10)
    const allDisplays = screen.getAllDisplays()
    const display = allDisplays.find((d: any) => d.id === displayIndex) 
      || allDisplays[displayIndex]
      || screen.getPrimaryDisplay()
    return display?.bounds || null
  })

  // HUD → main relay
  ipcMain.on(IPC.HUD_STOP, () => {
    mainWindow.webContents.send(IPC.HUD_STOP)
  })
  ipcMain.on(IPC.HUD_PAUSE, (_e, paused: boolean) => {
    mainWindow.webContents.send(IPC.HUD_PAUSE, paused)
  })

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:close', () => mainWindow.close())
  // Move off-screen instead of hiding — hiding suspends timers/RAF/setInterval in the renderer
  ipcMain.handle('window:hide', () => {
    // Move far off-screen rather than hide() — hide() suspends JS timers in the renderer
    mainWindow.setPosition(-10000, -10000)
  })
  ipcMain.handle('window:show', () => {
    const { screen } = require('electron')
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    mainWindow.setPosition(
      Math.round((width - mainWindow.getBounds().width) / 2),
      Math.round((height - mainWindow.getBounds().height) / 2)
    )
    mainWindow.focus()
  })
}
