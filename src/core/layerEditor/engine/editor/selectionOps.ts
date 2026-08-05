import type { Rect } from '../node'

export function rectSelectionCanvas(
  docW: number,
  docH: number,
  rect: Rect
): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = docW
  c.height = docH
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#000000'
  g.fillRect(0, 0, docW, docH)
  g.fillStyle = '#ffffff'
  g.fillRect(rect.x, rect.y, rect.w, rect.h)
  return c
}

export function fullSelectionCanvas(
  docW: number,
  docH: number
): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = docW
  c.height = docH
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, docW, docH)
  return c
}

export function invertSelectionCanvas(
  src: HTMLCanvasElement
): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'difference'
  g.drawImage(src, 0, 0)
  return c
}

export function lumaBBox(canvas: HTMLCanvasElement): Rect | null {
  const g = canvas.getContext('2d')
  if (!g) return null
  const data = g.getImageData(0, 0, canvas.width, canvas.height).data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function clampRectToDoc(
  rect: Rect,
  docW: number,
  docH: number
): Rect | null {
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const r = Math.min(docW, Math.ceil(rect.x + rect.w))
  const b = Math.min(docH, Math.ceil(rect.y + rect.h))
  if (r - x < 1 || b - y < 1) return null
  return { x, y, w: r - x, h: b - y }
}
