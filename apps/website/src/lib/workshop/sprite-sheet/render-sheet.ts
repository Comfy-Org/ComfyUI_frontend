import { loadImage } from '@/lib/workshop/relight/render-image'
import type { SpriteMotion, SpriteStyle } from './options'
import { SPRITE_GRID, SPRITE_STYLES } from './options'
import type { Bounds, Pixels } from './pixels'
import { inkOutline, opaqueBounds, pixelArt, toonShade } from './pixels'
import type { FramePose } from './poses'
import { framePose } from './poses'

const CELL = 256
const PIXEL_SCALE = 3
const GROUND = 0.9
const HEIGHT = 0.62
const FEET = 0.16
const INK = [27, 19, 32] as const
const STILL: FramePose = {
  lift: 0,
  shift: 0,
  tilt: 0,
  squash: 0,
  stride: 0,
  shadow: 1
}

interface Character {
  readonly image: HTMLCanvasElement
  readonly bounds: Bounds
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d', { willReadFrequently: true })
  if (context) context.imageSmoothingQuality = 'high'
  return context ? { element, context } : undefined
}

/** The character cut to the box around its opaque pixels. */
async function loadCharacter(url: string): Promise<Character | undefined> {
  const image = await loadImage(url)
  const whole = image && canvas(image.naturalWidth, image.naturalHeight)
  if (!image || !whole) return undefined
  whole.context.drawImage(image, 0, 0)
  const pixels = whole.context.getImageData(
    0,
    0,
    whole.element.width,
    whole.element.height
  )
  return { image: whole.element, bounds: opaqueBounds(pixels) }
}

function filtered(
  context: CanvasRenderingContext2D,
  look: (p: Pixels) => Pixels
) {
  const { width, height } = context.canvas
  const next = look(context.getImageData(0, 0, width, height))
  context.putImageData(
    new ImageData(new Uint8ClampedArray(next.data), width, height),
    0,
    0
  )
}

/** Draws the character posed on a `size` square, its feet on the ground. */
function drawPosed(
  context: CanvasRenderingContext2D,
  { image, bounds }: Character,
  pose: FramePose,
  size: number
) {
  const scale = Math.min(
    (size * HEIGHT) / bounds.height,
    (size * 0.86) / bounds.width
  )
  const width = bounds.width * scale
  const height = bounds.height * scale
  const feet = bounds.height * FEET
  context.save()
  context.translate(
    size / 2 + pose.shift * size,
    size * GROUND - pose.lift * size
  )
  context.rotate((pose.tilt * Math.PI) / 180)
  context.scale(1 + pose.squash, 1 - pose.squash)
  const body = bounds.height - feet
  context.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    body,
    -width / 2,
    -height,
    width,
    body * scale
  )
  const half = bounds.width / 2
  for (const [side, lift] of [
    [0, Math.max(0, pose.stride)],
    [1, Math.max(0, -pose.stride)]
  ] as const)
    context.drawImage(
      image,
      bounds.x + side * half,
      bounds.y + body,
      half,
      feet,
      -width / 2 + side * (width / 2),
      -feet * scale - lift * height,
      width / 2,
      feet * scale
    )
  context.restore()
}

function drawShadow(
  context: CanvasRenderingContext2D,
  pose: FramePose,
  size: number,
  soft: boolean
) {
  context.save()
  context.fillStyle = 'rgba(8, 6, 14, 0.32)'
  if (soft) context.filter = `blur(${size * 0.012}px)`
  context.beginPath()
  context.ellipse(
    size / 2,
    size * GROUND,
    size * 0.24 * pose.shadow,
    size * 0.04 * pose.shadow,
    0,
    0,
    Math.PI * 2
  )
  context.fill()
  context.restore()
}

/** Soft light from the upper left over the character, for the 3D look. */
function shade(context: CanvasRenderingContext2D, size: number) {
  context.save()
  context.globalCompositeOperation = 'source-atop'
  const light = context.createRadialGradient(
    size * 0.36,
    size * 0.3,
    0,
    size * 0.36,
    size * 0.3,
    size * 0.55
  )
  light.addColorStop(0, 'rgba(255, 246, 230, 0.42)')
  light.addColorStop(1, 'rgba(255, 246, 230, 0)')
  context.fillStyle = light
  context.fillRect(0, 0, size, size)
  const dark = context.createLinearGradient(0, size * 0.35, size * 0.2, size)
  dark.addColorStop(0, 'rgba(24, 14, 52, 0)')
  dark.addColorStop(1, 'rgba(24, 14, 52, 0.42)')
  context.fillStyle = dark
  context.fillRect(0, 0, size, size)
  context.restore()
}

/** One frame in `style`: a shadow on the ground, then the posed character. */
function drawFrame(
  target: CanvasRenderingContext2D,
  character: Character,
  pose: FramePose,
  style: SpriteStyle
) {
  const size = style === 'pixel' ? CELL / PIXEL_SCALE : CELL
  const layer = canvas(size, size)
  if (!layer) return
  drawShadow(layer.context, pose, size, style === '3d')
  const figure = canvas(size, size)
  if (!figure) return
  drawPosed(figure.context, character, pose, size)
  if (style === 'pixel')
    filtered(figure.context, (pixels) => inkOutline(pixelArt(pixels), 1, INK))
  if (style === 'toon')
    filtered(figure.context, (pixels) => inkOutline(toonShade(pixels), 3, INK))
  if (style === '3d') shade(figure.context, size)
  layer.context.drawImage(figure.element, 0, 0)
  target.imageSmoothingEnabled = style !== 'pixel'
  target.drawImage(layer.element, 0, 0, CELL, CELL)
}

function toBlobUrl(element: HTMLCanvasElement): Promise<string | undefined> {
  return new Promise((resolve) =>
    element.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : undefined),
      'image/png'
    )
  )
}

/**
 * The sheet for a pose and a style: eight frames four to a row on a clear
 * background, as a PNG object URL the caller revokes. Undefined where the
 * image or a 2D canvas is not available.
 */
export async function renderSpriteSheet(
  url: string,
  look: {
    readonly style: SpriteStyle
    readonly motion: SpriteMotion
    readonly seed: number
  }
): Promise<string | undefined> {
  const character = await loadCharacter(url)
  const { frames, columns, rows } = SPRITE_GRID
  const sheet = character && canvas(columns * CELL, rows * CELL)
  if (!character || !sheet) return undefined
  for (let index = 0; index < frames; index++) {
    const pose = framePose(look.motion, index, frames, look.seed)
    sheet.context.save()
    sheet.context.translate(
      (index % columns) * CELL,
      Math.floor(index / columns) * CELL
    )
    drawFrame(sheet.context, character, pose, look.style)
    sheet.context.restore()
  }
  return toBlobUrl(sheet.element)
}

/** The character standing in each style, small, as PNG data URLs. */
export async function renderStyleThumbnails(
  url: string
): Promise<Partial<Record<SpriteStyle, string>> | undefined> {
  const character = await loadCharacter(url)
  if (!character) return undefined
  const thumbnails: Partial<Record<SpriteStyle, string>> = {}
  for (const style of SPRITE_STYLES) {
    const frame = canvas(CELL, CELL)
    if (!frame) return undefined
    drawFrame(frame.context, character, STILL, style)
    thumbnails[style] = frame.element.toDataURL('image/png')
  }
  return thumbnails
}
