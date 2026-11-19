import { encodeRgbaAsPng } from './pngEncodeUtil'

export interface CanvasBlobLayer {
  canvas: HTMLCanvasElement
  blob: Blob
}

export interface ImageOutput {
  maskedImage: CanvasBlobLayer
  paintLayer: CanvasBlobLayer
  paintedImage: CanvasBlobLayer
  paintedMaskedImage: CanvasBlobLayer
}

export async function createImageOutput({
  imgCanvas,
  maskCanvas,
  paintCanvas
}: {
  imgCanvas: HTMLCanvasElement
  maskCanvas: HTMLCanvasElement
  paintCanvas: HTMLCanvasElement
}): Promise<ImageOutput> {
  const [maskedImage, paintLayer, paintedImage, paintedMaskedImage] =
    await Promise.all([
      createLayer(imgCanvas, null, maskCanvas),
      createLayer(paintCanvas),
      createLayer(imgCanvas, paintCanvas),
      createLayer(imgCanvas, paintCanvas, maskCanvas)
    ])
  return { maskedImage, paintLayer, paintedImage, paintedMaskedImage }
}

async function createLayer(
  source: HTMLCanvasElement,
  paintCanvas: HTMLCanvasElement | null = null,
  maskCanvas: HTMLCanvasElement | null = null
): Promise<CanvasBlobLayer> {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  if (paintCanvas) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(paintCanvas, 0, 0)
  }
  const blob = maskCanvas
    ? await encodeRgbaAsPng(applyMaskAsAlpha(ctx, maskCanvas))
    : await canvasToBlob(canvas)
  return { canvas, blob }
}

function applyMaskAsAlpha(
  ctx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement
): ImageData {
  const maskCtx = maskCanvas.getContext('2d')!
  const maskData = maskCtx.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height
  )
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i + 3] = 255 - maskData.data[i + 3]
  }
  ctx.putImageData(imageData, 0, 0)
  return imageData
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create blob from canvas'))
    }, 'image/png')
  })
}
