import { loadImage } from '../relight/render-image'
import type { CutoutRequest } from './contract'
import { FORMAT_TYPES } from './contract'
import { UPLOAD_SOLID, UPLOAD_SUBJECT, subjectMatte } from './mask'

const MAX_FEATHER = 0.004

function drawUploadMatte(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
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

function toObjectUrl(canvas: HTMLCanvasElement, type: string) {
  return new Promise<string | undefined>((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : undefined),
      type,
      0.92
    )
  )
}

/**
 * Draws a request's cutout: the photo kept inside its subject matte, the
 * edge feathered by `edgeSoftness`, over the requested fill, encoded in the
 * requested format. Answers an object URL, or undefined where it cannot.
 */
export async function renderCutout(
  request: CutoutRequest
): Promise<string | undefined> {
  const matteUrl = subjectMatte(request.imageUrl)
  const [image, matte] = await Promise.all([
    loadImage(request.imageUrl),
    matteUrl ? loadImage(matteUrl) : undefined
  ])
  if (!image) return undefined
  const { naturalWidth: width, naturalHeight: height } = image
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const feather =
    (request.edgeSoftness / 100) * Math.max(width, height) * MAX_FEATHER
  if (feather > 0) context.filter = `blur(${feather}px)`
  if (matte) context.drawImage(matte, 0, 0, width, height)
  else drawUploadMatte(context, width, height)
  context.filter = 'none'
  context.globalCompositeOperation = 'source-in'
  context.drawImage(image, 0, 0, width, height)
  if (request.backgroundColor) {
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = request.backgroundColor
    context.fillRect(0, 0, width, height)
  }
  return toObjectUrl(canvas, FORMAT_TYPES[request.format])
}
