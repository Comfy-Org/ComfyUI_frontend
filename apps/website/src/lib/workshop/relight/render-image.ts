import type { Light, MoodId, RelightScene } from './lights'
import { MOOD_IDS } from './lights'
import type { RelightRequest } from './mock-run'
import { createRelightRenderer } from './renderer'
import type { HeightMap } from './shading'
import { heightMap, shadingUniforms } from './shading'

const HEIGHT_EDGE = 384
const MAX_EDGE = 4096
const FINISH = { contrast: 1.06, grain: 0.035 }

/** A decoded image, or undefined when it does not load. */
export function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = url
  })
}

/** The image drawn no larger than `edge` on its long side. */
export function fitImage(image: HTMLImageElement, edge: number) {
  const scale = Math.min(
    1,
    edge / Math.max(image.naturalWidth, image.naturalHeight)
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, context, scale }
}

/** The photo's pseudo height map, read from a small copy of it. */
export function imageHeightMap(image: HTMLImageElement): HeightMap | undefined {
  const { canvas, context } = fitImage(image, HEIGHT_EDGE)
  const pixels = context?.getImageData(0, 0, canvas.width, canvas.height)
  return pixels && heightMap(pixels.data, canvas.width, canvas.height)
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

/**
 * The request's lights rendered over its photo at full size, with a
 * generated image's finish, as an object URL the caller revokes. Undefined
 * where the photo or WebGL is not available.
 */
export async function renderRelitImage(
  request: RelightRequest
): Promise<string | undefined> {
  const image = await loadImage(request.imageUrl)
  const height = image && imageHeightMap(image)
  if (!image || !height) return undefined
  const source = fitImage(image, MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = source.canvas.width
  canvas.height = source.canvas.height
  const renderer = createRelightRenderer(canvas, {
    preserveDrawingBuffer: true
  })
  if (!renderer) return undefined
  renderer.setImage(source.scale < 1 ? source.canvas : image, height)
  renderer.draw(shadingUniforms(request.lights, request.masks, request.scene), {
    finish: FINISH,
    seed: request.generation.seed
  })
  const blob = await toBlob(canvas)
  renderer.dispose()
  return blob ? URL.createObjectURL(blob) : undefined
}

const THUMB_EDGE = 200

/**
 * The photo relit by each set of lights, small, as JPEG data URLs keyed
 * like `looks`. Undefined where the photo or WebGL is not available.
 */
export async function renderMoodThumbnails(
  url: string,
  looks: Readonly<Partial<Record<MoodId, readonly Light[]>>>,
  scene: RelightScene
): Promise<Partial<Record<MoodId, string>> | undefined> {
  const image = await loadImage(url)
  const height = image && imageHeightMap(image)
  if (!image || !height) return undefined
  const source = fitImage(image, THUMB_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = source.canvas.width
  canvas.height = source.canvas.height
  const renderer = createRelightRenderer(canvas, {
    preserveDrawingBuffer: true
  })
  if (!renderer) return undefined
  renderer.setImage(source.canvas, height)
  const thumbnails: Partial<Record<MoodId, string>> = {}
  for (const mood of MOOD_IDS) {
    const lights = looks[mood]
    if (!lights) continue
    renderer.draw(shadingUniforms(lights, [], scene))
    thumbnails[mood] = canvas.toDataURL('image/jpeg', 0.8)
  }
  renderer.dispose()
  return thumbnails
}
