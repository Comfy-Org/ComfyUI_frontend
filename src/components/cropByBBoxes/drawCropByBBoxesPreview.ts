import {
  fitContain,
  previewWorld
} from '@/components/cropByBBoxes/cropByBBoxesGeometry'
import type { Bounds } from '@/renderer/core/layout/types'

export interface CropPreviewScene {
  image: CanvasImageSource
  imageWidth: number
  imageHeight: number
  boxes: readonly Bounds[]
  crop?: {
    region: Bounds
    frame: Bounds
    sizeFrame?: Bounds
    cropLabel: string
    outputLabel: string
  }
}

const LABEL_FONT = '11px sans-serif'
const LABEL_PADDING = 4
const LABEL_HEIGHT = 16
const DETECTION_COLOR = 'rgba(250, 204, 21, 0.9)'
const FRAME_OUTSET = 3
const SIZE_FRAME_COLOR = 'rgba(200, 200, 200, 0.8)'

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
) {
  ctx.font = LABEL_FONT
  const width = ctx.measureText(text).width + LABEL_PADDING * 2
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(x, y, width, LABEL_HEIGHT)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + LABEL_PADDING, y + LABEL_HEIGHT / 2)
}

export function drawCropByBBoxesPreview(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CropPreviewScene
) {
  ctx.clearRect(0, 0, width, height)

  const { crop } = scene
  const world = previewWorld(
    { width: scene.imageWidth, height: scene.imageHeight },
    crop ? [crop.frame, crop.sizeFrame].filter((f) => f !== undefined) : []
  )
  const margin = FRAME_OUTSET + 1
  const fitted = fitContain(world, {
    width: width - margin * 2,
    height: height - margin * 2
  })
  const view = { ...fitted, x: fitted.x + margin, y: fitted.y + margin }
  const scale = view.width / world.width
  const toCanvas = (b: Bounds): Bounds => ({
    x: view.x + (b.x - world.x) * scale,
    y: view.y + (b.y - world.y) * scale,
    width: b.width * scale,
    height: b.height * scale
  })

  const image = toCanvas({
    x: 0,
    y: 0,
    width: scene.imageWidth,
    height: scene.imageHeight
  })
  ctx.drawImage(scene.image, image.x, image.y, image.width, image.height)

  if (crop) {
    const region = toCanvas(crop.region)
    const frame = toCanvas(crop.frame)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.beginPath()
    ctx.rect(image.x, image.y, image.width, image.height)
    ctx.rect(region.x, region.y, region.width, region.height)
    ctx.fill('evenodd')

    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.width, frame.height)
    ctx.rect(region.x, region.y, region.width, region.height)
    ctx.fill('evenodd')
  }

  ctx.strokeStyle = DETECTION_COLOR
  ctx.lineWidth = 1
  for (const box of scene.boxes) {
    const b = toCanvas(box)
    ctx.strokeRect(b.x, b.y, b.width, b.height)
  }

  if (!crop) return

  const region = toCanvas(crop.region)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  ctx.strokeRect(region.x, region.y, region.width, region.height)
  drawLabel(ctx, crop.cropLabel, region.x + 2, region.y + 2)

  if (crop.sizeFrame) {
    const sizeFrame = toCanvas(crop.sizeFrame)
    ctx.strokeStyle = SIZE_FRAME_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(sizeFrame.x, sizeFrame.y, sizeFrame.width, sizeFrame.height)
  }

  const frame = toCanvas(crop.frame)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.strokeRect(
    frame.x - FRAME_OUTSET,
    frame.y - FRAME_OUTSET,
    frame.width + FRAME_OUTSET * 2,
    frame.height + FRAME_OUTSET * 2
  )
  ctx.setLineDash([])
  const labelled = crop.sizeFrame ? toCanvas(crop.sizeFrame) : frame
  drawLabel(
    ctx,
    crop.outputLabel,
    labelled.x + 2,
    labelled.y + labelled.height - LABEL_HEIGHT - 2
  )
}

export function renderCropByBBoxesPreview(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  scene: CropPreviewScene
) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawCropByBBoxesPreview(ctx, width, height, scene)
}
