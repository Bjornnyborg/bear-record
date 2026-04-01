import { execSync, spawn, ChildProcess } from 'child_process'

let trackingInterval: NodeJS.Timeout | null = null
let onBoundsChange: ((bounds: { x: number; y: number; width: number; height: number } | null) => void) | null = null
let trackingId = 0
let persistentPs: ChildProcess | null = null
let psReady = false

/**
 * Extract the native window handle (hwnd) from an Electron desktopCapturer sourceId.
 * Format on Windows: "window:hwnd:0" where hwnd is the decimal window handle.
 */
function extractHwnd(sourceId: string): string | null {
  const match = sourceId.match(/^window:(\d+):/)
  return match ? match[1] : null
}

/**
 * Start a persistent PowerShell process with the type pre-loaded
 */
function ensurePersistentPs(): void {
  if (persistentPs && !persistentPs.killed) return
  
  const initScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinBounds {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  public static string Get(long h) {
    RECT r;
    return GetWindowRect(new IntPtr(h), out r) ? r.Left+","+r.Top+","+(r.Right-r.Left)+","+(r.Bottom-r.Top) : "null";
  }
  public static void Focus(long h) { SetForegroundWindow(new IntPtr(h)); }
}
'@
Write-Host "READY"
while ($true) {
  $cmd = Read-Host
  if ($cmd -match '^GET (.+)$') { [WinBounds]::Get([long]$Matches[1]) }
  elseif ($cmd -match '^FOCUS (.+)$') { [WinBounds]::Focus([long]$Matches[1]); "OK" }
  elseif ($cmd -eq 'EXIT') { break }
}
`
  
  persistentPs = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  persistentPs.stdout?.on('data', (data) => {
    const str = data.toString()
    if (str.includes('READY')) {
      psReady = true
    }
  })
  
  persistentPs.on('error', () => { persistentPs = null; psReady = false })
  persistentPs.on('close', () => { persistentPs = null; psReady = false })
  
  persistentPs.stdin?.write(initScript + '\n')
}

/**
 * Get window bounds using persistent PowerShell
 */
function getWindowBoundsSync(hwnd: string): { x: number; y: number; width: number; height: number } | null {
  if (process.platform !== 'win32') return null
  
  try {
    // Use a simple one-shot VBScript approach which is faster than PowerShell Add-Type
    const vbs = `
Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
hwnd = ${hwnd}
' We cannot use VBScript to get window rect directly, so we output a placeholder
WScript.Echo "fallback"
`
    // Actually, VBScript can't do GetWindowRect. Use a simpler compiled approach.
    // For now, use execSync with PowerShell but only for initial call
    const result = execSync(
      `powershell -NoProfile -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')|Out-Null;$r=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$r.Width,$r.Height" 2>nul`,
      { encoding: 'utf8', windowsHide: true, timeout: 500 }
    ).trim()
    
    // This won't give us window bounds, just screen bounds. Return null to fall back.
    return null
  } catch {
    return null
  }
}

/**
 * Get window bounds async using persistent PS or spawning
 */
function getWindowBounds(hwnd: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null)
      return
    }
    
    // Use quick compiled approach - spawn cscript with JScript (faster than PowerShell)
    const js = `var sh=new ActiveXObject("WScript.Shell");var hwnd=${hwnd};try{var t=new ActiveXObject("htmlfile");t.write("<script>var r={};var u32=new ActiveXObject('DynamicWrapperX');u32.Register('user32.dll','GetWindowRect','i=ll','r=l');var rect=u32.MemAlloc(16);if(u32.GetWindowRect(${hwnd},rect)){r.l=u32.NumGet(rect,0,'l');r.t=u32.NumGet(rect,4,'l');r.r=u32.NumGet(rect,8,'l');r.b=u32.NumGet(rect,12,'l');};u32.MemFree(rect);<\\/script>");WScript.Echo(t.parentWindow.r.l+','+t.parentWindow.r.t+','+(t.parentWindow.r.r-t.parentWindow.r.l)+','+(t.parentWindow.r.b-t.parentWindow.r.t));}catch(e){WScript.Echo("null")}`;
    
    // That requires DynamicWrapperX which isn't standard. Fall back to PowerShell.
    const script = `Add-Type -Name W -Namespace X -Member '[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);public struct RECT{public int L,T,R,B;}' -EA 0;$r=New-Object X.W+RECT;if([X.W]::GetWindowRect([IntPtr]${hwnd},[ref]$r)){"$($r.L),$($r.T),$($r.R-$r.L),$($r.B-$r.T)"}else{"null"}`
    
    const ps = spawn('powershell', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    const timeout = setTimeout(() => { ps.kill(); resolve(null) }, 2000)

    ps.stdout.on('data', (d) => { stdout += d.toString() })
    ps.on('close', () => {
      clearTimeout(timeout)
      const result = stdout.trim()
      if (result === 'null' || !result) { resolve(null); return }
      const [x, y, width, height] = result.split(',').map(Number)
      if ([x, y, width, height].some(isNaN)) { resolve(null); return }
      resolve({ x, y, width, height })
    })
    ps.on('error', () => { clearTimeout(timeout); resolve(null) })
  })
}

/**
 * Focus a window by its desktopCapturer sourceId
 */
export function focusWindow(sourceId: string): void {
  if (process.platform !== 'win32') return
  const hwnd = extractHwnd(sourceId)
  if (!hwnd) return
  
  try {
    execSync(
      `powershell -NoProfile -Command "Add-Type -Name W -Namespace X -Member '[DllImport(\\\"user32.dll\\\")]public static extern bool SetForegroundWindow(IntPtr h);' -EA 0;[X.W]::SetForegroundWindow([IntPtr]${hwnd})"`,
      { windowsHide: true, timeout: 1000, encoding: 'utf8' }
    )
  } catch { /* ignore */ }
}

/**
 * Start tracking a window's bounds and call the callback when they change.
 */
export function startWindowTracking(
  sourceId: string,
  callback: (bounds: { x: number; y: number; width: number; height: number } | null) => void
): boolean {
  const hwnd = extractHwnd(sourceId)
  if (!hwnd) {
    console.warn('[windowTracker] Could not extract hwnd from sourceId:', sourceId)
    return false
  }
  
  console.log('[windowTracker] Starting tracking for hwnd:', hwnd)

  stopWindowTracking()
  onBoundsChange = callback
  trackingId++
  const myId = trackingId

  let lastBounds: string | null = null
  let pollCount = 0

  const poll = async () => {
    if (myId !== trackingId) return // Stale, abort
    pollCount++
    console.log(`[windowTracker] Poll #${pollCount} for hwnd ${hwnd}`)
    const bounds = await getWindowBounds(hwnd)
    if (myId !== trackingId) return // Check again after async
    
    console.log('[windowTracker] Got bounds:', bounds)
    const boundsStr = bounds ? JSON.stringify(bounds) : null

    // Only notify if bounds changed
    if (boundsStr !== lastBounds) {
      lastBounds = boundsStr
      onBoundsChange?.(bounds)
    }
  }

  // Poll immediately, then every 250ms
  poll()
  trackingInterval = setInterval(poll, 250)

  return true
}

/**
 * Stop tracking window bounds.
 */
export function stopWindowTracking(): void {
  trackingId++ // Invalidate any pending async operations
  if (trackingInterval) {
    clearInterval(trackingInterval)
    trackingInterval = null
  }
  onBoundsChange = null
}
