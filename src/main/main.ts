import { app, BrowserWindow, ipcMain, session, globalShortcut } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'

let recordingShortcutsRegistered = false
let isPaused = false

export function registerRecordingShortcuts() {
  if (recordingShortcutsRegistered) return
  
  // Ctrl+Shift+R to stop recording
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hud:stop')
    }
  })
  
  // Ctrl+Shift+P to pause/resume
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      isPaused = !isPaused
      mainWindow.webContents.send('hud:pause', isPaused)
    }
  })
  
  recordingShortcutsRegistered = true
}

export function unregisterRecordingShortcuts() {
  globalShortcut.unregister('CommandOrControl+Shift+R')
  globalShortcut.unregister('CommandOrControl+Shift+P')
  recordingShortcutsRegistered = false
  isPaused = false
}

let mainWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let regionWindow: BrowserWindow | null = null
let borderWindow: BrowserWindow | null = null

export function getMainWindow() { return mainWindow }
export function getHudWindow() { return hudWindow }
export function getRegionWindow() { return regionWindow }

export function createBorderWindow(x: number, y: number, width: number, height: number) {
  if (borderWindow && !borderWindow.isDestroyed()) borderWindow.close()
  // Window covers the exact region; border is drawn inset so it sits fully inside
  const B = 4 // border thickness in px
  borderWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    roundedCorners: false,
    // macOS-specific options
    ...(process.platform === 'darwin' ? {
      type: 'panel',
      hiddenInMissionControl: true,
    } : {}),
    webPreferences: { contextIsolation: true }
  })
  borderWindow.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(
      `<!DOCTYPE html><html><head><style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{width:100%;height:100%;background:transparent;overflow:hidden}
        .border{
          position:absolute;
          top:0;left:0;right:0;bottom:0;
          outline:${B}px solid #ff3b30;
          outline-offset:-${B}px;
          animation:p 1.2s ease-in-out infinite;
        }
        @keyframes p{0%,100%{opacity:1}50%{opacity:0.5}}
      </style></head><body><div class="border"></div></body></html>`
    )
  )
  borderWindow.setIgnoreMouseEvents(true)
  borderWindow.setAlwaysOnTop(true, 'screen-saver')
  // Exclude from screen capture so it's visible to user but not in recording
  // Note: This works reliably on Windows but may not work on macOS
  borderWindow.setContentProtection(true)
  if (process.platform === 'darwin') {
    borderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
}

export function createFullscreenBorderWindow(sourceId?: string) {
  const { screen } = require('electron')
  
  // Find the display matching the source ID (format: "screen:displayIndex:0")
  let display = screen.getPrimaryDisplay()
  if (sourceId) {
    const match = sourceId.match(/^screen:(\d+):/)
    if (match) {
      const displayIndex = parseInt(match[1], 10)
      const allDisplays = screen.getAllDisplays()
      // displayIndex from Electron is the display.id or order
      const found = allDisplays.find((d: any) => d.id === displayIndex) 
        || allDisplays[displayIndex]
        || display
      display = found
    }
  }
  
  // Use bounds (not workArea) so border covers full screen including taskbar
  const { x, y, width, height } = display.bounds
  if (borderWindow && !borderWindow.isDestroyed()) borderWindow.close()
  const B = 4
  borderWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    roundedCorners: false,
    // fullscreen required on Windows to go above taskbar
    fullscreen: false,
    // macOS-specific options
    ...(process.platform === 'darwin' ? {
      type: 'panel',
      hiddenInMissionControl: true,
    } : {}),
    webPreferences: { contextIsolation: true }
  })
  borderWindow.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(
      `<!DOCTYPE html><html><head><style>
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{width:100%;height:100%;background:transparent;overflow:hidden}
        .border{
          position:absolute;
          top:0;left:0;right:0;bottom:0;
          outline:${B}px solid #ff3b30;
          outline-offset:-${B}px;
          animation:p 1.2s ease-in-out infinite;
        }
        @keyframes p{0%,100%{opacity:1}50%{opacity:0.5}}
      </style></head><body><div class="border"></div></body></html>`
    )
  )
  borderWindow.setIgnoreMouseEvents(true)
  // On Windows, push above taskbar
  borderWindow.setAlwaysOnTop(true, 'screen-saver')
  // Exclude from screen capture so it's visible to user but not in recording
  // Note: This works reliably on Windows but may not work on macOS
  borderWindow.setContentProtection(true)
  if (process.platform === 'darwin') {
    borderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
}

export function closeBorderWindow() {
  if (borderWindow && !borderWindow.isDestroyed()) {
    borderWindow.close()
    borderWindow = null
  }
}

export function updateBorderWindow(x: number, y: number, width: number, height: number) {
  if (borderWindow && !borderWindow.isDestroyed()) {
    borderWindow.setBounds({ x, y, width, height })
  } else {
    // Create border if it doesn't exist
    createBorderWindow(x, y, width, height)
  }
}

export function createHudWindow(webcamDeviceId?: string, captureArea?: { x: number; y: number; width: number; height: number }) {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show()
    return
  }
  const hasWebcam = !!webcamDeviceId
  
  // Calculate webcam size for HUD (25% of min dimension - half of MP4 size for less intrusion)
  let webcamSize = 140 // default
  if (captureArea) {
    webcamSize = Math.round(Math.min(captureArea.width, captureArea.height) * 0.25)
  }
  
  const hudWidth = hasWebcam ? webcamSize + 20 : 220
  const hudHeight = hasWebcam ? webcamSize + 70 : 64 // extra space for controls at top
  hudWindow = new BrowserWindow({
    width: hudWidth,
    height: hudHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    // macOS-specific options that may help exclude from screen capture
    ...(process.platform === 'darwin' ? {
      type: 'panel', // Panel windows can be excluded from some capture scenarios on macOS
      hiddenInMissionControl: true,
    } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  hudWindow.setAlwaysOnTop(true, 'screen-saver')
  // Exclude from screen capture so it's visible to user but not in recording
  // Note: This works reliably on Windows but may not work on macOS
  hudWindow.setContentProtection(true)
  // On macOS, also try these additional settings
  if (process.platform === 'darwin') {
    hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  const params = webcamDeviceId 
    ? `?webcam=${encodeURIComponent(webcamDeviceId)}&size=${webcamSize}` 
    : ''
  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    hudWindow.loadURL(url + '/hud.html' + params)
  } else {
    hudWindow.loadFile(join(__dirname, '../../dist-renderer/hud.html'), { search: params })
  }
  
  // Position HUD based on webcam presence
  // With webcam: bottom-left of capture area (matching final video position)
  // Without webcam: top-center of capture area
  if (captureArea) {
    if (hasWebcam) {
      // Position so webcam circle is at bottom-left with 3% margin (matching ffmpeg)
      const margin = Math.round(Math.min(captureArea.width, captureArea.height) * 0.03)
      hudWindow.setPosition(
        captureArea.x + margin - 10, // -10 for HUD padding
        captureArea.y + captureArea.height - webcamSize - margin - 60 // -60 for controls bar
      )
    } else {
      hudWindow.setPosition(
        Math.round(captureArea.x + (captureArea.width - hudWidth) / 2),
        captureArea.y + 20
      )
    }
  } else {
    const { workAreaSize } = require('electron').screen.getPrimaryDisplay()
    if (hasWebcam) {
      const margin = Math.round(Math.min(workAreaSize.width, workAreaSize.height) * 0.03)
      hudWindow.setPosition(margin - 10, workAreaSize.height - webcamSize - margin - 60)
    } else {
      hudWindow.setPosition(
        Math.round((workAreaSize.width - hudWidth) / 2),
        20
      )
    }
  }
  hudWindow.on('closed', () => { hudWindow = null })
}

export function closeHudWindow() {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close()
    hudWindow = null
  }
}

export function createRegionWindow(): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const { screen } = require('electron')
    const display = screen.getPrimaryDisplay()
    const { width, height } = display.bounds

    regionWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreen: false,
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    const url = process.env['ELECTRON_RENDERER_URL']
    if (url) {
      regionWindow.loadURL(url + '/region.html')
    } else {
      regionWindow.loadFile(join(__dirname, '../../dist-renderer/region.html'))
    }

    ipcMain.once('region:result', (_e, result) => {
      if (regionWindow && !regionWindow.isDestroyed()) {
        regionWindow.close()
        regionWindow = null
      }
      resolve(result)
    })

    ipcMain.once('region:cancel', () => {
      if (regionWindow && !regionWindow.isDestroyed()) {
        regionWindow.close()
        regionWindow = null
      }
      resolve(null)
    })

    regionWindow.on('closed', () => {
      regionWindow = null
    })
  })
}

function createMainWindow() {
  const iconPath = join(__dirname, '../../assets/icon.png')
  mainWindow = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 700,
    minHeight: 520,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f0f',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Allow getUserMedia for screen/mic/camera in renderer
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'mediaKeySystem']
    callback(allowed.includes(permission))
  })

  registerIpcHandlers(mainWindow)

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    mainWindow.loadURL(url)
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist-renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    app.quit()
  })
}

app.whenReady().then(() => {
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
})
