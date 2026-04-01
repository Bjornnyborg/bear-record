// Region selector — runs in its own BrowserWindow
const canvas = document.getElementById('c') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

canvas.width = window.innerWidth
canvas.height = window.innerHeight

let startX = 0, startY = 0, dragging = false
let selX = 0, selY = 0, selW = 0, selH = 0

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (dragging && selW !== 0 && selH !== 0) {
    const x = selW < 0 ? selX + selW : selX
    const y = selH < 0 ? selY + selH : selY
    const w = Math.abs(selW)
    const h = Math.abs(selH)

    // Clear selection area
    ctx.clearRect(x, y, w, h)

    // Border
    ctx.strokeStyle = '#ff6b35'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    // Dimensions label
    const label = `${w} × ${h}`
    ctx.font = 'bold 13px -apple-system, sans-serif'
    const tw = ctx.measureText(label).width
    const lx = Math.min(x + w / 2 - tw / 2, canvas.width - tw - 8)
    const ly = y > 24 ? y - 8 : y + h + 18
    ctx.fillStyle = '#ff6b35'
    ctx.fillRect(lx - 6, ly - 14, tw + 12, 20)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, lx, ly)
  }

  // Instructions when not dragging
  if (!dragging) {
    const msg = 'Drag to select a region  ·  Esc to cancel'
    ctx.font = '14px -apple-system, sans-serif'
    const tw = ctx.measureText(msg).width
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(canvas.width / 2 - tw / 2 - 12, canvas.height / 2 - 18, tw + 24, 32)
    ctx.fillStyle = '#f0f0f0'
    ctx.fillText(msg, canvas.width / 2 - tw / 2, canvas.height / 2 + 2)
  }
}

canvas.addEventListener('mousedown', (e) => {
  startX = e.clientX
  startY = e.clientY
  selX = startX
  selY = startY
  selW = 0
  selH = 0
  dragging = true
})

canvas.addEventListener('mousemove', (e) => {
  if (!dragging) return
  selW = e.clientX - startX
  selH = e.clientY - startY
  draw()
})

canvas.addEventListener('mouseup', (e) => {
  dragging = false
  const x = selW < 0 ? selX + selW : selX
  const y = selH < 0 ? selY + selH : selY
  const w = Math.abs(selW)
  const h = Math.abs(selH)

  if (w > 10 && h > 10) {
    window.electronAPI.sendRegionResult({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) })
  } else {
    window.electronAPI.sendRegionCancel()
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.electronAPI.sendRegionCancel()
})

draw()
