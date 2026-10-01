import { loadImage } from '../relight/render-image'
import type { HandSwapRequest } from './contract'
import { clearWhiteBackdrop } from './cutout'
import { HAND_EXAMPLE } from './examples'
import { gripRect } from './placement'

const MAX_EDGE = 2048

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

/** The product cut out of a white backdrop and shaded like a cylinder. */
function productLayer(product: HTMLImageElement) {
  const canvas = canvasOf(product.naturalWidth, product.naturalHeight)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return canvas
  context.drawImage(product, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  if (clearWhiteBackdrop(pixels.data, canvas.width, canvas.height))
    context.putImageData(pixels, 0, 0)
  const shade = context.createLinearGradient(0, 0, canvas.width, 0)
  shade.addColorStop(0, 'rgba(40, 24, 14, 0.28)')
  shade.addColorStop(0.35, 'rgba(255, 244, 230, 0.06)')
  shade.addColorStop(1, 'rgba(40, 24, 14, 0.34)')
  context.globalCompositeOperation = 'source-atop'
  context.fillStyle = shade
  context.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

/**
 * The request's product drawn into its hand photo, as an object URL the
 * caller revokes, or undefined where an image does not load. On the worked
 * example the product goes onto the photo without its can and the hand is
 * drawn back over it, so the fingers wrap the new product.
 */
export async function renderSwapImage(
  request: HandSwapRequest
): Promise<string | undefined> {
  const example = request.handImageUrl === HAND_EXAMPLE.url
  const [base, product, grip] = await Promise.all([
    loadImage(example ? HAND_EXAMPLE.plate : request.handImageUrl),
    loadImage(request.productImageUrl),
    example ? loadImage(HAND_EXAMPLE.grip) : Promise.resolve(undefined)
  ])
  if (!base || !product) return undefined
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(base.naturalWidth, base.naturalHeight)
  )
  const canvas = canvasOf(base.naturalWidth * scale, base.naturalHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const { width, height } = canvas
  context.drawImage(base, 0, 0, width, height)
  const spot = gripRect(
    product.naturalWidth,
    product.naturalHeight,
    request.region,
    width / height
  )
  const x = spot.x * width
  const y = spot.y * height
  const w = spot.w * width
  const h = spot.h * height
  context.save()
  context.filter = `blur(${Math.round(w * 0.12)}px)`
  context.fillStyle = 'rgba(52, 34, 22, 0.32)'
  context.beginPath()
  context.ellipse(
    x + w * 0.75,
    y + h * 0.98,
    w * 0.7,
    h * 0.07,
    0,
    0,
    Math.PI * 2
  )
  context.fill()
  context.restore()
  context.drawImage(productLayer(product), x, y, w, h)
  if (grip) context.drawImage(grip, 0, 0, width, height)
  const blob = await toBlob(canvas)
  return blob ? URL.createObjectURL(blob) : undefined
}
