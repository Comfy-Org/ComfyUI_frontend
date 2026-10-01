import type { PaparazziRequest } from './contract'
import type { FaceCrop } from './draw-figures'
import { drawCrowd, drawFlashes, drawStar, drawYou } from './draw-figures'
import { drawScene } from './draw-scene'
import { dateStamp, seededRandom, snappers } from './random'
import type { SceneId } from './setup'
import { outputSize } from './setup'

const MAX_RENDER_WIDTH = 1536

function canvas(width: number, height: number) {
  const made = document.createElement('canvas')
  made.width = width
  made.height = height
  const ctx = made.getContext('2d')
  return ctx ? { made, ctx } : undefined
}

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}

function toUrl(made: HTMLCanvasElement): Promise<string | undefined> {
  return new Promise((resolve) =>
    made.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : undefined),
      'image/jpeg',
      0.9
    )
  )
}

function compose(
  ctx: CanvasRenderingContext2D,
  request: PaparazziRequest,
  face: HTMLImageElement | undefined,
  crop: FaceCrop,
  w: number,
  h: number
) {
  drawScene(ctx, request.scene, request.sceneDescription, w, h)
  drawStar(ctx, request.scene, w, h)
  drawYou(ctx, face, crop, request.scene, w, h)
  drawCrowd(ctx, snappers(request.seed), w, h)
}

function streak(source: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const shift = source.width * 0.004
  ctx.save()
  for (const step of [-2, -1, 1, 2]) {
    ctx.globalAlpha = 0.14
    ctx.drawImage(source, step * shift, 0)
  }
  ctx.restore()
}

function flashLight(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  const light = ctx.createRadialGradient(
    w * 0.5,
    h * 0.36,
    0,
    w * 0.5,
    h * 0.4,
    w * 0.55
  )
  light.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
  light.addColorStop(0.55, 'rgba(255, 255, 255, 0.25)')
  light.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** Film grain from a small tile of seeded noise, laid over the frame. */
function grain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number
) {
  const tile = canvas(192, 192)
  if (!tile) return
  const random = seededRandom(seed ^ 0x9e3779b9)
  const pixels = tile.ctx.createImageData(192, 192)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const value = Math.round(random() * 255)
    pixels.data.set([value, value, value, 46], index)
  }
  tile.ctx.putImageData(pixels, 0, 0)
  const pattern = ctx.createPattern(tile.made, 'repeat')
  if (!pattern) return
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const shade = ctx.createRadialGradient(
    w / 2,
    h * 0.45,
    h * 0.35,
    w / 2,
    h * 0.45,
    w * 0.68
  )
  shade.addColorStop(0, 'transparent')
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.6)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, w, h)
}

function stamp(
  ctx: CanvasRenderingContext2D,
  request: PaparazziRequest,
  w: number,
  h: number
) {
  const size = Math.round(h * 0.034)
  ctx.save()
  ctx.font = `600 ${size}px ui-monospace, Menlo, monospace`
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  ctx.shadowColor = 'rgba(255, 120, 30, 0.9)'
  ctx.shadowBlur = size * 0.6
  ctx.fillStyle = '#ff9a3c'
  ctx.fillText(dateStamp(request.seed), w * 0.955, h * 0.95)
  ctx.textAlign = 'left'
  ctx.shadowBlur = 0
  ctx.font = `700 ${Math.round(size * 0.8)}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.fillText(`${request.celebrity.toUpperCase()} + YOU`, w * 0.045, h * 0.95)
  ctx.restore()
}

/** Tilts the frame a little, the way a photo shot over a crowd lands. */
function tilt(source: HTMLCanvasElement, seed: number) {
  const out = canvas(source.width, source.height)
  if (!out) return source
  const angle = ((seededRandom(seed)() - 0.5) * 4 * Math.PI) / 180
  const { ctx, made } = out
  ctx.translate(made.width / 2, made.height / 2)
  ctx.rotate(angle)
  ctx.scale(1.06, 1.06)
  ctx.drawImage(source, -made.width / 2, -made.height / 2)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return made
}

/**
 * The finished press photo for a request: the composition, then the flash,
 * a little motion blur, the crowd's flash bursts, grain and a date stamp.
 */
export async function renderPaparazziImage(
  request: PaparazziRequest,
  crop: FaceCrop
): Promise<string | undefined> {
  const size = outputSize(request.resolution)
  const w = Math.min(size.width, MAX_RENDER_WIDTH)
  const h = Math.round((w * size.height) / size.width)
  const base = canvas(w, h)
  if (!base) return undefined
  const face = await loadImage(request.faceUrl)
  compose(base.ctx, request, face, crop, w, h)
  const shot = canvas(w, h)
  if (!shot) return undefined
  shot.ctx.filter = 'contrast(1.2) saturate(1.1) brightness(1.12)'
  shot.ctx.drawImage(base.made, 0, 0)
  shot.ctx.filter = 'none'
  streak(base.made, shot.ctx)
  flashLight(shot.ctx, w, h)
  drawFlashes(shot.ctx, snappers(request.seed), w, h)
  const tilted = tilt(shot.made, request.seed)
  const final = tilted.getContext('2d')
  if (!final) return undefined
  vignette(final, w, h)
  grain(final, w, h, request.seed)
  stamp(final, request, w, h)
  return toUrl(tilted)
}

/** The calm composition before the run: who stands where, in which scene. */
export async function renderPaparazziPreview(
  request: PaparazziRequest,
  crop: FaceCrop | undefined,
  width = 1200
): Promise<string | undefined> {
  const height = Math.round((width * 2) / 3)
  const base = canvas(width, height)
  if (!base) return undefined
  const face = crop ? await loadImage(request.faceUrl) : undefined
  compose(
    base.ctx,
    request,
    face,
    crop ?? { cx: 0.5, cy: 0.5, size: 1 },
    width,
    height
  )
  return toUrl(base.made)
}

/** A small picture of a preset scene's backdrop, for its tile. */
export function renderSceneThumbnail(
  scene: SceneId,
  width = 320
): string | undefined {
  const height = Math.round((width * 9) / 16)
  const made = canvas(width, height)
  if (!made) return undefined
  drawScene(made.ctx, scene, '', width, height)
  return made.made.toDataURL('image/jpeg', 0.85)
}
