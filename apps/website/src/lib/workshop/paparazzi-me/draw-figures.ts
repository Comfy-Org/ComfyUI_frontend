import type { Snapper } from './random'
import type { SceneId } from './setup'

/** Where the face sits in its photo: centre and size, as fractions. */
export interface FaceCrop {
  readonly cx: number
  readonly cy: number
  /** The head's height as a fraction of the photo's height. */
  readonly size: number
}

const YOU_X = 0.37
const STAR_X = 0.64

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function body(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  halfWidth: number,
  h: number
) {
  ctx.beginPath()
  ctx.moveTo(x - halfWidth * 0.3, top)
  ctx.bezierCurveTo(
    x - halfWidth * 0.8,
    top + h * 0.01,
    x - halfWidth,
    top + h * 0.04,
    x - halfWidth,
    top + h * 0.12
  )
  ctx.lineTo(x - halfWidth * 0.92, h)
  ctx.lineTo(x + halfWidth * 0.92, h)
  ctx.lineTo(x + halfWidth, top + h * 0.12)
  ctx.bezierCurveTo(
    x + halfWidth,
    top + h * 0.04,
    x + halfWidth * 0.8,
    top + h * 0.01,
    x + halfWidth * 0.3,
    top
  )
  ctx.fill()
}

function shaded(
  ctx: CanvasRenderingContext2D,
  x: number,
  halfWidth: number,
  rgb: readonly number[]
) {
  const tone = (scale: number) =>
    `rgb(${rgb.map((channel) => Math.round(channel * scale)).join(' ')})`
  const fill = ctx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0)
  fill.addColorStop(0, tone(0.35))
  fill.addColorStop(0.35, tone(0.85))
  fill.addColorStop(0.6, tone(0.75))
  fill.addColorStop(1, tone(0.3))
  return fill
}

const TINTS = {
  'red-carpet': '#6a2f74',
  'street-night': '#24396b',
  cafe: '#b06a2c',
  airport: '#9cb6c6',
  custom: '#5a4a6a'
} as const satisfies Record<SceneId | 'custom', string>

function featherInto(paint: CanvasRenderingContext2D, w: number, h: number) {
  paint.save()
  paint.globalCompositeOperation = 'destination-in'
  paint.translate(w / 2, h * 0.46)
  paint.scale(1, h / w)
  const mask = paint.createRadialGradient(0, 0, 0, 0, 0, w / 2)
  mask.addColorStop(0, '#000')
  mask.addColorStop(0.62, '#000')
  mask.addColorStop(1, 'transparent')
  paint.fillStyle = mask
  paint.fillRect(-w / 2, -w / 2, w, w)
  paint.restore()
}

/** The average colour low in the photo: what they wear. */
function clothing(paint: CanvasRenderingContext2D, w: number, h: number) {
  const { data } = paint.getImageData(w * 0.35, h * 0.62, w * 0.3, h * 0.08)
  const sum = [0, 0, 0]
  for (let index = 0; index < data.length; index += 4)
    for (const channel of [0, 1, 2]) sum[channel] += data[index + channel]
  const count = data.length / 4 || 1
  return sum.map((total) => total / count)
}

/** The visitor: their photo's head and shoulders, feathered into the scene. */
export function drawYou(
  ctx: CanvasRenderingContext2D,
  face: HTMLImageElement | undefined,
  crop: FaceCrop,
  scene: SceneId | 'custom',
  w: number,
  h: number
) {
  const side = h * 0.3
  const x = w * YOU_X
  const headY = h * 0.33
  if (!face) {
    ctx.fillStyle = '#231f1d'
    body(ctx, x, h * 0.56, w * 0.12, h)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
    ellipse(ctx, x, headY, side * 0.3, side * 0.38)
    return
  }
  const sourceSide = crop.size * face.naturalHeight
  const layer = document.createElement('canvas')
  layer.width = Math.round(side * 1.1)
  layer.height = Math.round(side * 1.6)
  const paint = layer.getContext('2d')
  if (!paint) return
  paint.drawImage(
    face,
    crop.cx * face.naturalWidth - sourceSide * 0.55,
    crop.cy * face.naturalHeight - sourceSide * 0.5,
    sourceSide * 1.1,
    sourceSide * 1.6,
    0,
    0,
    layer.width,
    layer.height
  )
  paint.globalCompositeOperation = 'soft-light'
  paint.globalAlpha = 0.45
  paint.fillStyle = TINTS[scene]
  paint.fillRect(0, 0, layer.width, layer.height)
  paint.globalAlpha = 1
  ctx.fillStyle = shaded(
    ctx,
    x,
    w * 0.11,
    clothing(paint, layer.width, layer.height)
  )
  body(ctx, x, h * 0.54, w * 0.11, h)
  featherInto(paint, layer.width, layer.height)
  ctx.drawImage(layer, x - layer.width / 2, headY - side * 0.5)
}

const OUTFITS = {
  'red-carpet': { coat: '#120d16', edge: '#3a2a44', hat: false, sparkle: true },
  'street-night': {
    coat: '#1d1a19',
    edge: '#3d4a6a',
    hat: false,
    sparkle: false
  },
  cafe: { coat: '#8c7a62', edge: '#d8c4a4', hat: true, sparkle: false },
  airport: { coat: '#16191e', edge: '#7f8f9c', hat: true, sparkle: false }
} as const satisfies Record<
  SceneId,
  { coat: string; edge: string; hat: boolean; sparkle: boolean }
>

function hair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
) {
  ctx.fillStyle = '#120c0a'
  ctx.beginPath()
  ctx.moveTo(x - rx * 1.2, y + ry * 1.9)
  ctx.bezierCurveTo(
    x - rx * 1.6,
    y,
    x - rx * 1.4,
    y - ry * 1.3,
    x,
    y - ry * 1.2
  )
  ctx.bezierCurveTo(
    x + rx * 1.4,
    y - ry * 1.3,
    x + rx * 1.6,
    y,
    x + rx * 1.2,
    y + ry * 1.9
  )
  ctx.closePath()
  ctx.fill()
}

function glasses(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
) {
  const lens = ctx.createLinearGradient(0, y - ry * 0.2, 0, y + ry * 0.2)
  lens.addColorStop(0, '#2c2a30')
  lens.addColorStop(1, '#020203')
  ctx.fillStyle = lens
  ellipse(ctx, x - rx * 0.42, y, rx * 0.38, ry * 0.19)
  ellipse(ctx, x + rx * 0.42, y, rx * 0.38, ry * 0.19)
  ctx.fillRect(x - rx * 0.1, y - ry * 0.05, rx * 0.2, ry * 0.05)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ellipse(ctx, x - rx * 0.52, y - ry * 0.07, rx * 0.08, ry * 0.035)
  ellipse(ctx, x + rx * 0.32, y - ry * 0.07, rx * 0.08, ry * 0.035)
}

/**
 * The star, drawn as a figure in dark glasses rather than a likeness: the
 * name only steers the real model, never this mock.
 */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  scene: SceneId | 'custom',
  w: number,
  h: number
) {
  const outfit = OUTFITS[scene === 'custom' ? 'street-night' : scene]
  const x = w * STAR_X
  const headY = h * 0.29
  const rx = w * 0.043
  const ry = w * 0.056
  ctx.save()
  ctx.filter = `blur(${Math.max(0.5, w * 0.0006)}px)`
  hair(ctx, x, headY, rx, ry)
  const coat = ctx.createLinearGradient(x - w * 0.12, 0, x + w * 0.12, 0)
  coat.addColorStop(0, outfit.edge)
  coat.addColorStop(0.25, outfit.coat)
  coat.addColorStop(0.8, outfit.coat)
  coat.addColorStop(1, outfit.edge)
  ctx.fillStyle = coat
  body(ctx, x, h * 0.42, w * 0.085, h)
  if (outfit.sparkle) {
    ctx.fillStyle = 'rgba(255, 244, 220, 0.5)'
    for (let index = 0; index < 120; index++) {
      const px = x + Math.sin(index * 12.9898) * w * 0.095
      const py = h * 0.47 + ((index * 37) % 100) * 0.0048 * h
      ctx.fillRect(px, py, w * 0.002, w * 0.002)
    }
  }
  const neck = ctx.createLinearGradient(x - rx, 0, x + rx, 0)
  neck.addColorStop(0, '#5e3c30')
  neck.addColorStop(0.5, '#a5735b')
  neck.addColorStop(1, '#5e3c30')
  ctx.fillStyle = neck
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.35, headY + ry * 0.6)
  ctx.lineTo(x - rx * 0.5, h * 0.43)
  ctx.lineTo(x + rx * 0.5, h * 0.43)
  ctx.lineTo(x + rx * 0.35, headY + ry * 0.6)
  ctx.fill()
  const skin = ctx.createRadialGradient(
    x - rx * 0.25,
    headY - ry * 0.25,
    0,
    x,
    headY,
    ry * 1.1
  )
  skin.addColorStop(0, '#d9a988')
  skin.addColorStop(0.7, '#9c6a52')
  skin.addColorStop(1, '#5a3a2e')
  ctx.fillStyle = skin
  ellipse(ctx, x, headY, rx, ry)
  ctx.fillStyle = '#7a2f33'
  ellipse(ctx, x, headY + ry * 0.55, rx * 0.22, ry * 0.07)
  ctx.fillStyle = '#120c0a'
  ctx.beginPath()
  ctx.ellipse(x, headY - ry * 0.35, rx * 1.08, ry * 0.75, 0, Math.PI, 0)
  ctx.quadraticCurveTo(
    x + rx * 0.3,
    headY - ry * 0.55,
    x - rx * 1.08,
    headY - ry * 0.35
  )
  ctx.fill()
  glasses(ctx, x, headY + ry * 0.02, rx, ry)
  if (outfit.hat) {
    ctx.fillStyle = '#141210'
    ellipse(ctx, x, headY - ry * 0.6, rx * 2.1, ry * 0.3)
    ellipse(ctx, x, headY - ry * 0.9, rx * 1.05, ry * 0.48)
  }
  ctx.restore()
}

/** The photographers in front, their cameras up, soft with depth. */
export function drawCrowd(
  ctx: CanvasRenderingContext2D,
  crowd: readonly Snapper[],
  w: number,
  h: number
) {
  ctx.save()
  ctx.filter = `blur(${Math.max(1, Math.round(w * 0.005))}px)`
  for (const snapper of crowd) {
    const x = snapper.x * w
    const y = snapper.y * h
    const s = snapper.scale * w * 0.8
    ctx.fillStyle = '#070609'
    ellipse(ctx, x, y + s * 0.13, s * 0.1, s * 0.07)
    ellipse(ctx, x, y + s * 0.02, s * 0.034, s * 0.044)
    ctx.fillStyle = '#18171c'
    ctx.fillRect(x - s * 0.038, y - s * 0.03, s * 0.076, s * 0.046)
    ctx.fillRect(x - s * 0.014, y - s * 0.048, s * 0.028, s * 0.018)
    ctx.fillStyle = '#2d2c33'
    ellipse(ctx, x, y - s * 0.007, s * 0.017, s * 0.017)
  }
  ctx.restore()
}

/** The bursts of the flashes that fire, over everything else. */
export function drawFlashes(
  ctx: CanvasRenderingContext2D,
  crowd: readonly Snapper[],
  w: number,
  h: number
) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const snapper of crowd.filter((candidate) => candidate.flashing)) {
    const x = snapper.x * w
    const y = snapper.y * h - snapper.scale * w * 0.8 * 0.039
    const r = w * 0.11 * snapper.scale
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, r)
    bloom.addColorStop(0, 'rgba(255, 255, 255, 1)')
    bloom.addColorStop(0.08, 'rgba(240, 245, 255, 0.75)')
    bloom.addColorStop(0.3, 'rgba(200, 215, 255, 0.18)')
    bloom.addColorStop(1, 'transparent')
    ctx.fillStyle = bloom
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    const glint = ctx.createLinearGradient(x - r * 0.6, 0, x + r * 0.6, 0)
    glint.addColorStop(0, 'transparent')
    glint.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)')
    glint.addColorStop(1, 'transparent')
    ctx.fillStyle = glint
    ctx.fillRect(x - r * 0.6, y - w * 0.001, r * 1.2, w * 0.002)
  }
  ctx.restore()
}
