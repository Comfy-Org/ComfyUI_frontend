import { memoize } from 'es-toolkit/compat'

import { isLightColor, parseToRgb, rgbToHex } from '@/utils/colorUtil'

export type CanvasBackgroundPattern = 'dots' | 'grid' | 'none'

const TILE_SIZE = 100
const SPACING = 20
const DOT_RADIUS = 1.25
const GRID_LINE_WIDTH = 1

const LIGHT_MARK_COLOR = 'rgba(255, 255, 255, 0.10)'
const DARK_MARK_COLOR = 'rgba(0, 0, 0, 0.13)'

let sharedContext: CanvasRenderingContext2D | null = null

function getSharedContext(): CanvasRenderingContext2D {
  sharedContext ??= document.createElement('canvas').getContext('2d')
  if (!sharedContext) throw new Error('2D canvas context unavailable')
  return sharedContext
}

/**
 * Normalizes any CSS color (hex, rgb()/hsl(), named colors like `lightgray`)
 * to opaque lowercase `#rrggbb`.
 */
function normalizeToHexColor(color: string): string {
  const trimmed = color.trim()
  if (trimmed.startsWith('#')) {
    return rgbToHex(parseToRgb(trimmed)).toLowerCase()
  }
  const ctx = getSharedContext()
  ctx.fillStyle = '#000000'
  ctx.fillStyle = trimmed
  const parsed = ctx.fillStyle
  return parsed.startsWith('#')
    ? parsed.toLowerCase()
    : rgbToHex(parseToRgb(parsed)).toLowerCase()
}

/**
 * Resolves the canvas background color: a user-set value (stored as hex
 * without `#`) wins over the active palette's color.
 */
export function getEffectiveCanvasBackgroundColor(
  settingValue: string,
  paletteColor: string
): string {
  return normalizeToHexColor(
    settingValue ? `#${settingValue.replace(/^#/, '')}` : paletteColor
  )
}

/** Faint mark color auto-contrasted against the background. */
export function getPatternMarkColor(backgroundColor: string): string {
  return isLightColor(normalizeToHexColor(backgroundColor))
    ? DARK_MARK_COLOR
    : LIGHT_MARK_COLOR
}

function drawDots(ctx: CanvasRenderingContext2D) {
  for (let x = SPACING / 2; x < TILE_SIZE; x += SPACING) {
    for (let y = SPACING / 2; y < TILE_SIZE; y += SPACING) {
      ctx.beginPath()
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = GRID_LINE_WIDTH
  for (let offset = 0; offset < TILE_SIZE; offset += SPACING) {
    ctx.beginPath()
    ctx.moveTo(offset + 0.5, 0)
    ctx.lineTo(offset + 0.5, TILE_SIZE)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, offset + 0.5)
    ctx.lineTo(TILE_SIZE, offset + 0.5)
    ctx.stroke()
  }
}

function renderPatternImage(
  pattern: CanvasBackgroundPattern,
  backgroundColor: string
): string {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const ground = normalizeToHexColor(backgroundColor)
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)

  const markColor = getPatternMarkColor(ground)
  ctx.fillStyle = markColor
  ctx.strokeStyle = markColor
  if (pattern === 'dots') drawDots(ctx)
  if (pattern === 'grid') drawGrid(ctx)

  return canvas.toDataURL('image/png')
}

/**
 * Generates an opaque repeating background tile as a data URI. The tile is
 * always opaque (including `none`) because LGraphCanvas paints only the tile
 * at zoom levels >= 1.5.
 */
export const generateCanvasPatternImage: (
  pattern: CanvasBackgroundPattern,
  backgroundColor: string
) => string = memoize(
  renderPatternImage,
  (pattern: CanvasBackgroundPattern, backgroundColor: string) =>
    `${pattern}:${backgroundColor}`
)
