/**
 * Excludes a BrowserWindow from screen capture at the OS level.
 *
 * Windows: SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)  — Windows 10 2004+
 * macOS:   [NSWindow setSharingType: NSWindowSharingNone]
 */

import type { BrowserWindow } from 'electron'

export function excludeWindowFromCapture(win: BrowserWindow) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi')

    if (process.platform === 'win32') {
      // getNativeWindowHandle() returns a Buffer whose bytes ARE the HWND value
      // Read it as a native pointer (8 bytes on 64-bit, little-endian)
      const buf = win.getNativeWindowHandle()
      const hwnd = buf.readBigUInt64LE(0)

      const user32 = koffi.load('user32.dll')
      const SetWindowDisplayAffinity = user32.func('bool SetWindowDisplayAffinity(intptr_t hWnd, uint32 dwAffinity)')
      const WDA_EXCLUDEFROMCAPTURE = 0x00000011
      const result = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
      console.log('[captureExclusion] Windows SetWindowDisplayAffinity result:', result)

    } else if (process.platform === 'darwin') {
      // getNativeWindowHandle() returns a Buffer containing the NSView* pointer value
      const viewBuf = win.getNativeWindowHandle()
      // Read the pointer value as a BigInt (8 bytes on 64-bit)
      const viewPtr = viewBuf.readBigUInt64LE(0)

      const objc = koffi.load('libobjc.dylib')
      // Use typed (non-variadic) signatures to avoid koffi variadic issues on arm64
      const sel_registerName = objc.func('void* sel_registerName(const char* str)')
      // objc_msgSend for (id, SEL, NSUInteger) -> void
      const objc_msgSend_window = objc.func('__cdecl void* objc_msgSend(void* self, void* op)')
      const objc_msgSend_setSharingType = objc.func('__cdecl void objc_msgSend_setSharingType(void* self, void* op, int sharingType)')

      // Re-register under a different name to get the typed signature
      // koffi allows loading the same symbol with different signatures
      const appKit = koffi.load('AppKit.framework/AppKit')
      void appKit // ensure framework is loaded so NSWindow class is available

      // Get NSWindow from NSView: [view window]
      const windowSel = sel_registerName('window')
      const nsWindowPtr = objc_msgSend_window(viewPtr, windowSel)
      console.log('[captureExclusion] nsWindowPtr:', nsWindowPtr)

      // [nsWindow setSharingType: NSWindowSharingNone (0)]
      const setSharingTypeSel = sel_registerName('setSharingType:')
      objc_msgSend_setSharingType(nsWindowPtr, setSharingTypeSel, 0)
      console.log('[captureExclusion] macOS setSharingType:0 called on NSWindow')
    }
  } catch (err) {
    console.warn('[captureExclusion] Failed:', err)
  }
}
