import { premultiplyData } from './brushDrawingUtils'
import { useMaskEditorStore } from './maskEditorStore'

export function useCanvasTransform() {
  const store = useMaskEditorStore()

  const rotateCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    clockwise: boolean
  ): ImageData => {
    const width = canvas.width
    const height = canvas.height

    const sourceData = ctx.getImageData(0, 0, width, height)

    const rotatedData = new ImageData(height, width)
    const src = sourceData.data
    const dst = rotatedData.data

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4

        let dstX: number, dstY: number
        if (clockwise) {
          dstX = height - 1 - y
          dstY = x
        } else {
          dstX = y
          dstY = width - 1 - x
        }

        const dstIdx = (dstY * height + dstX) * 4

        dst[dstIdx] = src[srcIdx]
        dst[dstIdx + 1] = src[srcIdx + 1]
        dst[dstIdx + 2] = src[srcIdx + 2]
        dst[dstIdx + 3] = src[srcIdx + 3]
      }
    }

    return rotatedData
  }

  const mirrorCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    horizontal: boolean
  ): ImageData => {
    const width = canvas.width
    const height = canvas.height

    const sourceData = ctx.getImageData(0, 0, width, height)
    const mirroredData = new ImageData(width, height)
    const src = sourceData.data
    const dst = mirroredData.data

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4

        let dstX: number, dstY: number
        if (horizontal) {
          dstX = width - 1 - x
          dstY = y
        } else {
          dstX = x
          dstY = height - 1 - y
        }

        const dstIdx = (dstY * width + dstX) * 4

        dst[dstIdx] = src[srcIdx]
        dst[dstIdx + 1] = src[srcIdx + 1]
        dst[dstIdx + 2] = src[srcIdx + 2]
        dst[dstIdx + 3] = src[srcIdx + 3]
      }
    }

    return mirroredData
  }

  const recreateGPUTextures = async (
    width: number,
    height: number
  ): Promise<void> => {
    if (
      !store.tgpuRoot ||
      !store.maskCanvas ||
      !store.rgbCanvas ||
      !store.maskCtx ||
      !store.rgbCtx
    ) {
      return
    }

    store.gpuTexturesNeedRecreation = true
    store.gpuTextureWidth = width
    store.gpuTextureHeight = height

    const maskImageData = store.maskCtx.getImageData(0, 0, width, height)
    const rgbImageData = store.rgbCtx.getImageData(0, 0, width, height)

    const maskData = new Uint8ClampedArray(
      new ArrayBuffer(maskImageData.data.length)
    )
    const rgbData = new Uint8ClampedArray(
      new ArrayBuffer(rgbImageData.data.length)
    )

    maskData.set(maskImageData.data)
    rgbData.set(rgbImageData.data)

    if (
      maskData.buffer instanceof SharedArrayBuffer ||
      rgbData.buffer instanceof SharedArrayBuffer
    ) {
      console.error(
        '[useCanvasTransform] SharedArrayBuffer detected, WebGPU writeTexture will fail'
      )
      return
    }

    premultiplyData(maskData)
    premultiplyData(rgbData)

    store.pendingGPUMaskData = maskData
    store.pendingGPURgbData = rgbData
  }

  const rotateClockwise = async (): Promise<void> => {
    const { maskCanvas, maskCtx, rgbCanvas, rgbCtx, imgCanvas, imgCtx } = store

    if (
      !maskCanvas ||
      !maskCtx ||
      !rgbCanvas ||
      !rgbCtx ||
      !imgCanvas ||
      !imgCtx
    ) {
      console.error('[useCanvasTransform] Canvas contexts not ready')
      return
    }

    const origWidth = maskCanvas.width
    const origHeight = maskCanvas.height

    const rotatedMask = rotateCanvas(maskCtx, maskCanvas, true)
    const rotatedRgb = rotateCanvas(rgbCtx, rgbCanvas, true)
    const rotatedImg = rotateCanvas(imgCtx, imgCanvas, true)

    maskCanvas.width = origHeight
    maskCanvas.height = origWidth
    rgbCanvas.width = origHeight
    rgbCanvas.height = origWidth
    imgCanvas.width = origHeight
    imgCanvas.height = origWidth

    maskCtx.putImageData(rotatedMask, 0, 0)
    rgbCtx.putImageData(rotatedRgb, 0, 0)
    imgCtx.putImageData(rotatedImg, 0, 0)

    if (store.tgpuRoot) {
      await recreateGPUTextures(origHeight, origWidth)
    }

    store.canvasHistory.saveState(rotatedMask, rotatedRgb, rotatedImg)
  }

  const rotateCounterclockwise = async (): Promise<void> => {
    const { maskCanvas, maskCtx, rgbCanvas, rgbCtx, imgCanvas, imgCtx } = store

    if (
      !maskCanvas ||
      !maskCtx ||
      !rgbCanvas ||
      !rgbCtx ||
      !imgCanvas ||
      !imgCtx
    ) {
      console.error('[useCanvasTransform] Canvas contexts not ready')
      return
    }

    const origWidth = maskCanvas.width
    const origHeight = maskCanvas.height

    const rotatedMask = rotateCanvas(maskCtx, maskCanvas, false)
    const rotatedRgb = rotateCanvas(rgbCtx, rgbCanvas, false)
    const rotatedImg = rotateCanvas(imgCtx, imgCanvas, false)

    maskCanvas.width = origHeight
    maskCanvas.height = origWidth
    rgbCanvas.width = origHeight
    rgbCanvas.height = origWidth
    imgCanvas.width = origHeight
    imgCanvas.height = origWidth

    maskCtx.putImageData(rotatedMask, 0, 0)
    rgbCtx.putImageData(rotatedRgb, 0, 0)
    imgCtx.putImageData(rotatedImg, 0, 0)

    if (store.tgpuRoot) {
      await recreateGPUTextures(origHeight, origWidth)
    }

    store.canvasHistory.saveState(rotatedMask, rotatedRgb, rotatedImg)
  }

  const mirrorHorizontal = async (): Promise<void> => {
    const { maskCanvas, maskCtx, rgbCanvas, rgbCtx, imgCanvas, imgCtx } = store

    if (
      !maskCanvas ||
      !maskCtx ||
      !rgbCanvas ||
      !rgbCtx ||
      !imgCanvas ||
      !imgCtx
    ) {
      console.error('[useCanvasTransform] Canvas contexts not ready')
      return
    }

    const mirroredMask = mirrorCanvas(maskCtx, maskCanvas, true)
    const mirroredRgb = mirrorCanvas(rgbCtx, rgbCanvas, true)
    const mirroredImg = mirrorCanvas(imgCtx, imgCanvas, true)

    maskCtx.putImageData(mirroredMask, 0, 0)
    rgbCtx.putImageData(mirroredRgb, 0, 0)
    imgCtx.putImageData(mirroredImg, 0, 0)

    if (store.tgpuRoot) {
      await recreateGPUTextures(maskCanvas.width, maskCanvas.height)
    }

    store.canvasHistory.saveState(mirroredMask, mirroredRgb, mirroredImg)
  }

  const mirrorVertical = async (): Promise<void> => {
    const { maskCanvas, maskCtx, rgbCanvas, rgbCtx, imgCanvas, imgCtx } = store

    if (
      !maskCanvas ||
      !maskCtx ||
      !rgbCanvas ||
      !rgbCtx ||
      !imgCanvas ||
      !imgCtx
    ) {
      console.error('[useCanvasTransform] Canvas contexts not ready')
      return
    }

    const mirroredMask = mirrorCanvas(maskCtx, maskCanvas, false)
    const mirroredRgb = mirrorCanvas(rgbCtx, rgbCanvas, false)
    const mirroredImg = mirrorCanvas(imgCtx, imgCanvas, false)

    maskCtx.putImageData(mirroredMask, 0, 0)
    rgbCtx.putImageData(mirroredRgb, 0, 0)
    imgCtx.putImageData(mirroredImg, 0, 0)

    if (store.tgpuRoot) {
      await recreateGPUTextures(maskCanvas.width, maskCanvas.height)
    }

    store.canvasHistory.saveState(mirroredMask, mirroredRgb, mirroredImg)
  }

  return {
    rotateClockwise,
    rotateCounterclockwise,
    mirrorHorizontal,
    mirrorVertical
  }
}
