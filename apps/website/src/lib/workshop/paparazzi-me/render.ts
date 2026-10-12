import type { Resolution } from './setup'
import { outputSize } from './setup'

/** Where the head sits in a face photo, as fractions of it. */
export interface FaceCrop {
  readonly cx: number
  readonly cy: number
  /** The head's size as a fraction of the photo's short side. */
  readonly size: number
}

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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

/**
 * The visitor's head and shoulders cut from the face photo with a soft,
 * oval edge, `height` tall.
 */
function portrait(face: HTMLImageElement, crop: FaceCrop, height: number) {
  const side = Math.min(face.naturalWidth, face.naturalHeight) * crop.size
  const sw = side * 1.1
  const sh = side * 1.6
  const width = Math.round((height * sw) / sh)
  const cut = canvas(width, height)
  if (!cut) return undefined
  cut.ctx.drawImage(
    face,
    face.naturalWidth * crop.cx - sw / 2,
    face.naturalHeight * crop.cy - side * 0.5,
    sw,
    sh,
    0,
    0,
    width,
    height
  )
  cut.ctx.globalCompositeOperation = 'destination-in'
  cut.ctx.translate(width / 2, height * 0.45)
  cut.ctx.scale(1, height / width)
  const fade = cut.ctx.createRadialGradient(0, 0, width * 0.34, 0, 0, width / 2)
  fade.addColorStop(0, 'black')
  fade.addColorStop(1, 'transparent')
  cut.ctx.fillStyle = fade
  cut.ctx.fillRect(-width / 2, -width / 2, width, width)
  return cut.made
}

function flash(ctx: CanvasRenderingContext2D, x: number, w: number, h: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  const light = ctx.createRadialGradient(x, h * 0.35, 0, x, h * 0.4, w * 0.5)
  light.addColorStop(0, 'rgba(255, 255, 255, 0.7)')
  light.addColorStop(1, 'rgba(0, 0, 0, 0.35)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/**
 * A stand-in result: the scene photo with the face stood in it at `you`,
 * as an object URL, or undefined where the canvas cannot draw.
 */
export async function renderPaparazziImage(
  scene: { readonly url: string; readonly you: number },
  faceUrl: string,
  crop: FaceCrop,
  resolution: Resolution
): Promise<string | undefined> {
  const size = outputSize(resolution)
  const w = Math.min(size.width, MAX_RENDER_WIDTH)
  const h = Math.round((w * size.height) / size.width)
  const shot = canvas(w, h)
  const [backdrop, face] = await Promise.all([
    loadImage(scene.url),
    loadImage(faceUrl)
  ])
  if (!shot || !backdrop) return undefined
  const x = w * scene.you
  drawCover(shot.ctx, backdrop, w, h)
  const you = face && portrait(face, crop, Math.round(h * 0.26))
  if (you) shot.ctx.drawImage(you, x - you.width / 2, h * 0.14)
  flash(shot.ctx, x, w, h)
  return new Promise((resolve) =>
    shot.made.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : undefined),
      'image/jpeg',
      0.9
    )
  )
}
