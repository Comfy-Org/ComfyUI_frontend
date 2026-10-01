import { dressPixels } from './composite'
import { outlinePath } from './garments'
import type { Area } from './garments'
import type { TryOnRequest, TryOnScene } from './mock-run'

const MAX_EDGE = 1600
const TILE_WIDTH = 0.16
const MASK_BLUR = 0.0055
const EDGE_BLUR = 0.02

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = url
  })
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return context ? { canvas, context } : undefined
}

/** The cloth, mirrored into a tile that repeats without seams. */
function fabricTile(garment: HTMLImageElement, fabric: Area, width: number) {
  const sx = fabric.x * garment.naturalWidth
  const sy = fabric.y * garment.naturalHeight
  const sw = fabric.w * garment.naturalWidth
  const sh = fabric.h * garment.naturalHeight
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round((width * sh) / sw))
  const tile = canvasOf(w * 2, h * 2)
  if (!tile) return undefined
  for (const [fx, fy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
  ]) {
    tile.context.setTransform(fx, 0, 0, fy, w, h)
    tile.context.drawImage(garment, sx, sy, sw, sh, 0, 0, w, h)
  }
  return tile.canvas
}

function maskPixels(
  path: Path2D,
  width: number,
  height: number,
  blur: number
): Uint8ClampedArray | undefined {
  const mask = canvasOf(width, height)
  if (!mask) return undefined
  mask.context.filter = `blur(${blur}px)`
  mask.context.fill(path)
  return mask.context.getImageData(0, 0, width, height).data
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

/**
 * The garment drawn over the person at up to `MAX_EDGE`, as an object URL
 * the caller revokes, or undefined where either image does not load.
 */
export async function renderTryOn(
  request: TryOnRequest,
  scene: TryOnScene
): Promise<string | undefined> {
  const [person, garment] = await Promise.all([
    loadImage(request.personImageUrl),
    loadImage(request.garmentImageUrl)
  ])
  if (!person || !garment) return undefined
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(person.naturalWidth, person.naturalHeight)
  )
  const width = Math.max(1, Math.round(person.naturalWidth * scale))
  const height = Math.max(1, Math.round(person.naturalHeight * scale))
  const photo = canvasOf(width, height)
  const cloth = canvasOf(width, height)
  const tile = fabricTile(garment, scene.fabric, width * TILE_WIDTH)
  const pattern = tile && cloth?.context.createPattern(tile, 'repeat')
  if (!photo || !cloth || !tile || !pattern) return undefined
  photo.context.drawImage(person, 0, 0, width, height)
  pattern.setTransform(
    new DOMMatrix().translate(
      (request.seed * 37) % tile.width,
      (request.seed * 53) % tile.height
    )
  )
  cloth.context.fillStyle = pattern
  cloth.context.fillRect(0, 0, width, height)
  const path = new Path2D(outlinePath(scene.outline, width, height))
  const mask = maskPixels(path, width, height, width * MASK_BLUR)
  const edge = maskPixels(path, width, height, width * EDGE_BLUR)
  if (!mask || !edge) return undefined
  const dressed = dressPixels(
    photo.context.getImageData(0, 0, width, height).data,
    cloth.context.getImageData(0, 0, width, height).data,
    mask,
    edge
  )
  photo.context.putImageData(new ImageData(dressed, width, height), 0, 0)
  const blob = await toBlob(photo.canvas)
  return blob ? URL.createObjectURL(blob) : undefined
}
