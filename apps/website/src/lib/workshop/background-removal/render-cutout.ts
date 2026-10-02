import { loadImage } from '../relight/render-image'
import type { CutoutRequest } from './contract'
import { FORMAT_TYPES, adjustFilter, blurBleed } from './contract'
import {
  CUTOUT_EXAMPLE,
  UPLOAD_SOLID,
  UPLOAD_SUBJECT,
  subjectMatte
} from './mask'

const MAX_FEATHER = 0.004
const REPLACE_GRADIENT = ['#e8cdb0', '#b8775a'] as const

type Context = CanvasRenderingContext2D

function drawUploadMatte(context: Context, width: number, height: number) {
  const { cx, cy, rx, ry } = UPLOAD_SUBJECT
  context.save()
  context.translate(cx * width, cy * height)
  context.scale(rx * width, ry * height)
  const fade = context.createRadialGradient(0, 0, 0, 0, 0, 1)
  fade.addColorStop(0, '#000')
  fade.addColorStop(UPLOAD_SOLID, '#000')
  fade.addColorStop(1, 'rgb(0 0 0 / 0)')
  context.fillStyle = fade
  context.beginPath()
  context.arc(0, 0, 1, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawCover(context: Context, image: HTMLImageElement) {
  const { width, height } = context.canvas
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight
  )
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
}

function toObjectUrl(canvas: HTMLCanvasElement, type: string) {
  return new Promise<string | undefined>((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : undefined),
      type,
      0.92
    )
  )
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d') ?? undefined
}

/** The photo kept inside its matte, the edge feathered, `filter` applied. */
function subjectLayer(
  photo: HTMLImageElement,
  matte: HTMLImageElement | undefined,
  edgeSoftness: number,
  filter: string
) {
  const { naturalWidth: width, naturalHeight: height } = photo
  const context = canvasOf(width, height)
  if (!context) return undefined
  const feather = (edgeSoftness / 100) * Math.max(width, height) * MAX_FEATHER
  if (feather > 0) context.filter = `blur(${feather}px)`
  if (matte) context.drawImage(matte, 0, 0, width, height)
  else drawUploadMatte(context, width, height)
  context.globalCompositeOperation = 'source-in'
  context.filter = filter
  context.drawImage(photo, 0, 0, width, height)
  return context.canvas
}

/** Paints what goes behind the subject, or the whole result (`done`). */
async function drawBackground(
  context: Context,
  request: CutoutRequest,
  photo: HTMLImageElement
): Promise<'subject' | 'done'> {
  const { width, height } = context.canvas
  if (request.mode === 'remove') {
    if (request.background.kind === 'color') {
      context.fillStyle = request.background.color
      context.fillRect(0, 0, width, height)
    }
    return 'subject'
  }
  if (request.mode === 'adjust') {
    if (request.adjust.target === 'background')
      context.filter = adjustFilter(
        request.adjust,
        (share) => `${share * width}px`
      )
    const bleed = blurBleed(request.adjust)
    context.drawImage(
      photo,
      (width * (1 - bleed)) / 2,
      (height * (1 - bleed)) / 2,
      width * bleed,
      height * bleed
    )
    context.filter = 'none'
    return 'subject'
  }
  const { referenceUrl } = request.replace
  const prepared =
    !referenceUrl && request.imageUrl === CUTOUT_EXAMPLE.url
      ? CUTOUT_EXAMPLE.replaced
      : undefined
  const backdropUrl = prepared ?? referenceUrl
  const backdrop = backdropUrl ? await loadImage(backdropUrl) : undefined
  if (backdrop) {
    drawCover(context, backdrop)
    return prepared ? 'done' : 'subject'
  }
  const fill = context.createLinearGradient(0, 0, 0, height)
  fill.addColorStop(0, REPLACE_GRADIENT[0])
  fill.addColorStop(1, REPLACE_GRADIENT[1])
  context.fillStyle = fill
  context.fillRect(0, 0, width, height)
  return 'subject'
}

/**
 * Draws a request's result in the browser: Remove puts the cut-out over
 * the chosen fill, Replace over the prepared or referenced backdrop, and
 * Adjust filters the chosen layer of the photo. Encoded in the requested
 * format; answers an object URL, or undefined where it cannot draw.
 */
export async function renderCutout(
  request: CutoutRequest
): Promise<string | undefined> {
  const matteUrl = subjectMatte(request.imageUrl)
  const [photo, matte] = await Promise.all([
    loadImage(request.imageUrl),
    matteUrl ? loadImage(matteUrl) : undefined
  ])
  if (!photo) return undefined
  const context = canvasOf(photo.naturalWidth, photo.naturalHeight)
  if (!context) return undefined
  if ((await drawBackground(context, request, photo)) === 'subject') {
    const foreground =
      request.mode === 'adjust' && request.adjust.target === 'foreground'
        ? adjustFilter(
            request.adjust,
            (share) => `${share * photo.naturalWidth}px`
          )
        : 'none'
    const subject = subjectLayer(photo, matte, request.edgeSoftness, foreground)
    if (subject) context.drawImage(subject, 0, 0)
  }
  return toObjectUrl(context.canvas, FORMAT_TYPES[request.format])
}
