import QuickLRU from '@alloc/quick-lru'

import { hexToRgb, parseToRgb } from '@/utils/colorUtil'
import { BrushShape } from '@/extensions/core/maskeditor/types'
import type { Point } from '@/extensions/core/maskeditor/types'

export type DirtyRect = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type MaskColor = { r: number; g: number; b: number }

const brushTextureCache = new QuickLRU<string, HTMLCanvasElement>({
  maxSize: 20
})

export function resetDirtyRect(): DirtyRect {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

export function updateDirtyRect(
  rect: DirtyRect,
  x: number,
  y: number,
  radius: number
): DirtyRect {
  const padding = 2
  return {
    minX: Math.min(rect.minX, x - radius - padding),
    minY: Math.min(rect.minY, y - radius - padding),
    maxX: Math.max(rect.maxX, x + radius + padding),
    maxY: Math.max(rect.maxY, y + radius + padding)
  }
}

function formatRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function premultiplyData(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    data[i] = Math.round(data[i] * a)
    data[i + 1] = Math.round(data[i + 1] * a)
    data[i + 2] = Math.round(data[i + 2] * a)
  }
}

function drawShapeOnContext(
  ctx: CanvasRenderingContext2D,
  brushType: BrushShape,
  x: number,
  y: number,
  radius: number
): void {
  ctx.beginPath()
  if (brushType === BrushShape.Rect) {
    ctx.rect(x - radius, y - radius, radius * 2, radius * 2)
  } else {
    ctx.arc(x, y, radius, 0, Math.PI * 2, false)
  }
  ctx.fill()
}

function createBrushGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  hardness: number,
  color: string,
  opacity: number,
  isErasing: boolean
): CanvasGradient {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) {
    return ctx.createRadialGradient(0, 0, 0, 0, 0, 0)
  }

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)

  if (isErasing) {
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
    gradient.addColorStop(hardness, `rgba(255, 255, 255, ${opacity})`)
    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`)
  } else {
    const { r, g, b } = parseToRgb(color)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`)
    gradient.addColorStop(hardness, `rgba(${r}, ${g}, ${b}, ${opacity})`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  }

  return gradient
}

function getCachedBrushTexture(
  radius: number,
  hardness: number,
  color: string,
  opacity: number
): HTMLCanvasElement {
  const cacheKey = `${radius}_${hardness}_${color}`
  const cached = brushTextureCache.get(cacheKey)
  if (cached) return cached

  const size = Math.max(1, Math.ceil(radius * 2))
  if (!Number.isFinite(size)) {
    throw new Error(`Invalid brush radius: ${radius}`)
  }

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = size
  tempCanvas.height = size
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) {
    throw new Error('Unable to create 2D canvas context for brush texture')
  }

  const centerX = size / 2
  const centerY = size / 2
  const hardRadius = radius * hardness
  const imageData = tempCtx.createImageData(size, size)
  const data = imageData.data
  const { r, g, b } = parseToRgb(color)
  const fadeRange = radius - hardRadius

  for (let y = 0; y < size; y++) {
    const dy = y + 0.5 - centerY
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - centerX
      const index = (y * size + x) * 4
      const distFromEdge = Math.max(Math.abs(dx), Math.abs(dy))

      let pixelOpacity = 0
      if (distFromEdge <= hardRadius) {
        pixelOpacity = opacity
      } else if (distFromEdge <= radius) {
        const fadeProgress = (distFromEdge - hardRadius) / fadeRange
        pixelOpacity = opacity * Math.pow(1 - fadeProgress, 2)
      }

      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
      data[index + 3] = pixelOpacity * 255
    }
  }

  tempCtx.putImageData(imageData, 0, 0)
  brushTextureCache.set(cacheKey, tempCanvas)
  return tempCanvas
}

export function drawRgbShape(
  ctx: CanvasRenderingContext2D,
  point: Point,
  brushType: BrushShape,
  brushRadius: number,
  hardness: number,
  opacity: number,
  rgbColor: string
): void {
  const { x, y } = point

  if (brushType === BrushShape.Rect && hardness < 1) {
    const rgbaColor = formatRgba(rgbColor, opacity)
    const brushTexture = getCachedBrushTexture(
      brushRadius,
      hardness,
      rgbaColor,
      opacity
    )
    ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius)
    return
  }

  if (hardness === 1) {
    ctx.fillStyle = formatRgba(rgbColor, opacity)
    drawShapeOnContext(ctx, brushType, x, y, brushRadius)
    return
  }

  const gradient = createBrushGradient(
    ctx,
    x,
    y,
    brushRadius,
    hardness,
    rgbColor,
    opacity,
    false
  )
  ctx.fillStyle = gradient
  drawShapeOnContext(ctx, brushType, x, y, brushRadius)
}

export function drawMaskShape(
  ctx: CanvasRenderingContext2D,
  point: Point,
  brushType: BrushShape,
  brushRadius: number,
  hardness: number,
  opacity: number,
  isErasing: boolean,
  maskColor: MaskColor
): void {
  const { x, y } = point

  if (brushType === BrushShape.Rect && hardness < 1) {
    const baseColor = isErasing
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
    const brushTexture = getCachedBrushTexture(
      brushRadius,
      hardness,
      baseColor,
      opacity
    )
    ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius)
    return
  }

  if (hardness === 1) {
    ctx.fillStyle = isErasing
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
    drawShapeOnContext(ctx, brushType, x, y, brushRadius)
    return
  }

  const maskColorHex = `rgb(${maskColor.r}, ${maskColor.g}, ${maskColor.b})`
  const gradient = createBrushGradient(
    ctx,
    x,
    y,
    brushRadius,
    hardness,
    maskColorHex,
    opacity,
    isErasing
  )
  ctx.fillStyle = gradient
  drawShapeOnContext(ctx, brushType, x, y, brushRadius)
}
