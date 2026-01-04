import { useMaskEditorStore } from '@/stores/maskEditorStore'

/**
 * Composable for canvas transformation operations (rotate, mirror)
 */
export function useCanvasTransform() {
  const store = useMaskEditorStore()

  /**
   * Rotates a canvas 90 degrees clockwise or counter-clockwise
   */
  const rotateCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    clockwise: boolean
  ): ImageData => {
    const width = canvas.width
    const height = canvas.height

    // Get current canvas data
    const sourceData = ctx.getImageData(0, 0, width, height)

    // Create new ImageData with swapped dimensions
    const rotatedData = new ImageData(height, width)
    const src = sourceData.data
    const dst = rotatedData.data

    // Rotate pixel by pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4

        // Calculate destination coordinates
        let dstX: number, dstY: number
        if (clockwise) {
          // Rotate 90° clockwise: (x,y) -> (height-1-y, x)
          dstX = height - 1 - y
          dstY = x
        } else {
          // Rotate 90° counter-clockwise: (x,y) -> (y, width-1-x)
          dstX = y
          dstY = width - 1 - x
        }

        const dstIdx = (dstY * height + dstX) * 4

        // Copy RGBA values
        dst[dstIdx] = src[srcIdx]
        dst[dstIdx + 1] = src[srcIdx + 1]
        dst[dstIdx + 2] = src[srcIdx + 2]
        dst[dstIdx + 3] = src[srcIdx + 3]
      }
    }

    return rotatedData
  }

  /**
   * Mirrors a canvas horizontally or vertically
   */
  const mirrorCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    horizontal: boolean
  ): ImageData => {
    const width = canvas.width
    const height = canvas.height

    // Get current canvas data
    const sourceData = ctx.getImageData(0, 0, width, height)
    const mirroredData = new ImageData(width, height)
    const src = sourceData.data
    const dst = mirroredData.data

    // Mirror pixel by pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4

        // Calculate destination coordinates
        let dstX: number, dstY: number
        if (horizontal) {
          // Mirror horizontally: flip X axis
          dstX = width - 1 - x
          dstY = y
        } else {
          // Mirror vertically: flip Y axis
          dstX = x
          dstY = height - 1 - y
        }

        const dstIdx = (dstY * width + dstX) * 4

        // Copy RGBA values
        dst[dstIdx] = src[srcIdx]
        dst[dstIdx + 1] = src[srcIdx + 1]
        dst[dstIdx + 2] = src[srcIdx + 2]
        dst[dstIdx + 3] = src[srcIdx + 3]
      }
    }

    return mirroredData
  }

  /**
   * Premultiplies alpha for GPU upload
   */
  const premultiplyData = (data: Uint8ClampedArray): void => {
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255
      data[i] = Math.round(data[i] * a)
      data[i + 1] = Math.round(data[i + 1] * a)
      data[i + 2] = Math.round(data[i + 2] * a)
    }
  }

  /**
   * Recreates and updates GPU textures after transformation
   * This is required because GPU textures have immutable dimensions
   */
  const recreateGPUTextures = async (
    width: number,
    height: number
  ): Promise<void> => {
    if (!store.tgpuRoot || !store.maskCanvas || !store.rgbCanvas) {
      return
    }

    // Get references to GPU resources from useBrushDrawing
    // These are stored as module-level variables in useBrushDrawing
    // We need to trigger a reinitialization through the store

    // Signal to useBrushDrawing that textures need recreation
    store.gpuTexturesNeedRecreation = true
    store.gpuTextureWidth = width
    store.gpuTextureHeight = height

    // Get current canvas data
    const maskImageData = store.maskCtx!.getImageData(0, 0, width, height)
    const rgbImageData = store.rgbCtx!.getImageData(0, 0, width, height)

    // Create new Uint8ClampedArray with ArrayBuffer (not SharedArrayBuffer)
    // This ensures compatibility with WebGPU writeTexture
    const maskData = new Uint8ClampedArray(
      new ArrayBuffer(maskImageData.data.length)
    )
    const rgbData = new Uint8ClampedArray(
      new ArrayBuffer(rgbImageData.data.length)
    )

    // Copy data
    maskData.set(maskImageData.data)
    rgbData.set(rgbImageData.data)
    /*
    if (maskData.buffer instanceof SharedArrayBuffer || rgbData.buffer instanceof SharedArrayBuffer) {
      console.error('[useCanvasTransform] SharedArrayBuffer detected, WebGPU writeTexture will fail')
      return
    }
    */
    // Premultiply alpha for GPU
    premultiplyData(maskData)
    premultiplyData(rgbData)

    // Store the premultiplied data for useBrushDrawing to pick up
    // Cast to ensure ArrayBuffer backing (not SharedArrayBuffer)
    store.pendingGPUMaskData = maskData as Uint8ClampedArray & {
      buffer: ArrayBuffer
    }
    store.pendingGPURgbData = rgbData as Uint8ClampedArray & {
      buffer: ArrayBuffer
    }
  }

  /**
   * Applies rotation to all canvas layers and updates GPU
   */
  const rotateAllLayers = async (clockwise: boolean): Promise<void> => {
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

    // Store original dimensions
    const origWidth = maskCanvas.width
    const origHeight = maskCanvas.height

    // Rotate all three layers
    const rotatedMask = rotateCanvas(maskCtx, maskCanvas, clockwise)
    const rotatedRgb = rotateCanvas(rgbCtx, rgbCanvas, clockwise)
    const rotatedImg = rotateCanvas(imgCtx, imgCanvas, clockwise)

    // Update canvas dimensions (swap width/height)
    maskCanvas.width = origHeight
    maskCanvas.height = origWidth
    rgbCanvas.width = origHeight
    rgbCanvas.height = origWidth
    imgCanvas.width = origHeight
    imgCanvas.height = origWidth

    // Apply rotated data
    maskCtx.putImageData(rotatedMask, 0, 0)
    rgbCtx.putImageData(rotatedRgb, 0, 0)
    imgCtx.putImageData(rotatedImg, 0, 0)

    // Recreate GPU textures with new dimensions if GPU is active
    if (store.tgpuRoot) {
      await recreateGPUTextures(origHeight, origWidth)
    }

    // Save to history
    store.canvasHistory.saveState(rotatedMask, rotatedRgb, rotatedImg)
  }

  /**
   * Applies mirroring to all canvas layers and updates GPU
   */
  const mirrorAllLayers = async (horizontal: boolean): Promise<void> => {
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

    // Mirror all three layers
    const mirroredMask = mirrorCanvas(maskCtx, maskCanvas, horizontal)
    const mirroredRgb = mirrorCanvas(rgbCtx, rgbCanvas, horizontal)
    const mirroredImg = mirrorCanvas(imgCtx, imgCanvas, horizontal)

    // Apply mirrored data (dimensions stay the same)
    maskCtx.putImageData(mirroredMask, 0, 0)
    rgbCtx.putImageData(mirroredRgb, 0, 0)
    imgCtx.putImageData(mirroredImg, 0, 0)

    // Update GPU textures if GPU is active (dimensions unchanged, just data)
    if (store.tgpuRoot) {
      await recreateGPUTextures(maskCanvas.width, maskCanvas.height)
    }

    // Save to history
    store.canvasHistory.saveState(mirroredMask, mirroredRgb, mirroredImg)
  }

  return {
    rotateAllLayers,
    mirrorAllLayers
  }
}
