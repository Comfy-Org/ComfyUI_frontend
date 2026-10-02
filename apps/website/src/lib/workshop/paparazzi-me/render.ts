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

/** The head cut from the face photo with a soft edge, `size` across. */
function softHead(face: HTMLImageElement, crop: FaceCrop, size: number) {
  const head = canvas(size, size)
  if (!head) return undefined
  const side = Math.min(face.naturalWidth, face.naturalHeight) * crop.size
  head.ctx.drawImage(
    face,
    face.naturalWidth * crop.cx - side / 2,
    face.naturalHeight * crop.cy - side / 2,
    side,
    side,
    0,
    0,
    size,
    size
  )
  const fade = head.ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.3,
    size / 2,
    size / 2,
    size / 2
  )
  fade.addColorStop(0, 'black')
  fade.addColorStop(1, 'transparent')
  head.ctx.globalCompositeOperation = 'destination-in'
  head.ctx.fillStyle = fade
  head.ctx.fillRect(0, 0, size, size)
  return head.made
}

function drawYou(
  ctx: CanvasRenderingContext2D,
  head: HTMLCanvasElement | undefined,
  x: number,
  h: number
) {
  const coat = ctx.createLinearGradient(0, h * 0.4, 0, h)
  coat.addColorStop(0, 'rgba(24, 22, 26, 0.96)')
  coat.addColorStop(1, 'rgba(8, 8, 10, 0.98)')
  ctx.fillStyle = coat
  ctx.beginPath()
  ctx.ellipse(x, h * 0.86, h * 0.12, h * 0.46, 0, 0, Math.PI * 2)
  ctx.fill()
  if (head) {
    const size = h * 0.2
    ctx.drawImage(head, x - size / 2, h * 0.2, size, size)
  }
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
  drawYou(shot.ctx, face && softHead(face, crop, Math.round(h * 0.2)), x, h)
  flash(shot.ctx, x, w, h)
  return new Promise((resolve) =>
    shot.made.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : undefined),
      'image/jpeg',
      0.9
    )
  )
}
