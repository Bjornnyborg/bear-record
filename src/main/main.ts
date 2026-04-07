import { app, BrowserWindow, ipcMain, session, globalShortcut, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { excludeWindowFromCapture } from './captureExclusion'

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
let webcamWindow: BrowserWindow | null = null
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
  if (process.platform === 'darwin') {
    borderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  excludeWindowFromCapture(borderWindow)
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
  if (process.platform === 'darwin') {
    borderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  excludeWindowFromCapture(borderWindow)
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

function makePanelWindow(opts: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const win = new BrowserWindow({
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    ...opts,
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  excludeWindowFromCapture(win)
  return win
}

export function createHudWindow(webcamDeviceId?: string, captureArea?: { x: number; y: number; width: number; height: number }) {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.show()
    return
  }

  const { screen } = require('electron')
  const area = captureArea ?? (() => {
    const { bounds } = screen.getPrimaryDisplay()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  })()

  // Controls pill — always center-top of capture area
  const HUD_W = 220, HUD_H = 48
  hudWindow = makePanelWindow({
    width: HUD_W,
    height: HUD_H,
    webPreferences: { preload: join(__dirname, '../preload/preload.js'), contextIsolation: true, nodeIntegration: false }
  })
  hudWindow.setPosition(
    Math.round(area.x + (area.width - HUD_W) / 2),
    area.y + 20
  )
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    hudWindow.loadURL(devUrl + '/hud.html')
  } else {
    hudWindow.loadFile(join(__dirname, '../../dist-renderer/hud.html'))
  }
  hudWindow.on('closed', () => { hudWindow = null })

  // Webcam — separate window at bottom-left of capture area
  if (webcamDeviceId) {
    const webcamSize = Math.round(Math.min(area.width, area.height) * 0.25)
    const margin = Math.round(Math.min(area.width, area.height) * 0.03)
    webcamWindow = makePanelWindow({
      width: webcamSize,
      height: webcamSize,
      webPreferences: { preload: join(__dirname, '../preload/preload.js'), contextIsolation: true, nodeIntegration: false }
    })
    webcamWindow.setPosition(
      area.x + margin,
      area.y + area.height - webcamSize - margin
    )
    const wcParams = `?webcam=${encodeURIComponent(webcamDeviceId)}&size=${webcamSize}`
    if (devUrl) {
      webcamWindow.loadURL(devUrl + '/hud.html' + wcParams)
    } else {
      webcamWindow.loadFile(join(__dirname, '../../dist-renderer/hud.html'), { search: wcParams })
    }
    webcamWindow.on('closed', () => { webcamWindow = null })
  }
}

export function closeHudWindow() {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.close()
    hudWindow = null
  }
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    webcamWindow.close()
    webcamWindow = null
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
    frame: true,
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
  if (process.env['ELECTRON_RENDERER_URL']) {
    // Dev mode: keep the default menu so DevTools (Cmd+Option+I / F12) works
    Menu.setApplicationMenu(Menu.getApplicationMenu())
  } else {
    Menu.setApplicationMenu(null)
  }
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
