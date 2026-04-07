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
      const viewBuf = win.getNativeWindowHandle()
      const viewPtr = viewBuf.readBigUInt64LE(0)

      koffi.load('/System/Library/Frameworks/AppKit.framework/AppKit')
      const objc = koffi.load('libobjc.dylib')
      const sel_registerName = objc.func('void* sel_registerName(const char* str)')
      // Load objc_msgSend twice with different signatures — koffi allows this via alias
      const objc_msgSend_ptr = objc.func('void* objc_msgSend(void* self, void* op)')
      const objc_msgSend_int = objc.func('void objc_msgSend(void* self, void* op, int value)')

      // [view window] -> NSWindow*
      const nsWindowPtr = objc_msgSend_ptr(viewPtr, sel_registerName('window'))
      console.log('[captureExclusion] nsWindowPtr:', nsWindowPtr)

      // [nsWindow setSharingType: NSWindowSharingNone (0)]
      objc_msgSend_int(nsWindowPtr, sel_registerName('setSharingType:'), 0)
      console.log('[captureExclusion] macOS setSharingType:0 done')
    }
  } catch (err) {
    console.warn('[captureExclusion] Failed:', err)
  }
}
