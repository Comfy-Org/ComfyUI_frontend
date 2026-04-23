/// <reference types="@webgpu/types" />
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { debounce } from 'es-toolkit/compat'
import { parseToRgb } from '@/utils/colorUtil'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import {
  Tools,
  BrushShape,
  CompositionOperation
} from '@/extensions/core/maskeditor/types'
import type { Brush, Point } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useCoordinateTransform } from './useCoordinateTransform'
import { resampleSegment } from './splineUtils'
import { tgpu } from 'typegpu'
import { GPUBrushRenderer } from './gpu/GPUBrushRenderer'
import { StrokeProcessor } from './StrokeProcessor'
import { getEffectiveBrushSize, getEffectiveHardness } from './brushUtils'
import {
  resetDirtyRect,
  updateDirtyRect,
  premultiplyData,
  drawRgbShape,
  drawMaskShape
} from './brushDrawingUtils'
import type { DirtyRect } from './brushDrawingUtils'

/**
 * Saves the brush settings to local storage with a debounce.
 * @param key - The storage key.
 * @param brush - The brush settings object.
 */
const saveBrushToCache = debounce(function (key: string, brush: Brush): void {
  try {
    const brushString = JSON.stringify(brush)
    setStorageValue(key, brushString)
  } catch (error) {
    console.error('Failed to save brush to cache:', error)
  }
}, 300)

/**
 * Loads brush settings from local storage.
 * @param key - The storage key.
 * @returns The brush settings object or null if not found.
 */
function loadBrushFromCache(key: string): Brush | null {
  try {
    const brushString = getStorageValue(key)
    if (brushString) {
      return JSON.parse(brushString) as Brush
    } else {
      return null
    }
  } catch (error) {
    console.error('Failed to load brush from cache:', error)
    return null
  }
}

export function useBrushDrawing(initialSettings?: {
  useDominantAxis?: boolean
  brushAdjustmentSpeed?: number
}) {
  const store = useMaskEditorStore()

  const coordinateTransform = useCoordinateTransform()

  // GPU Resources (Scoped to this composable instance)
  let maskTexture: GPUTexture | null = null
  let rgbTexture: GPUTexture | null = null
  let device: GPUDevice | null = null
  let renderer: GPUBrushRenderer | null = null
  let previewContext: GPUCanvasContext | null = null
  let previewCanvas: HTMLCanvasElement | null = null

  // Readback buffers
  let readbackStorageMask: GPUBuffer | null = null
  let readbackStorageRgb: GPUBuffer | null = null
  let readbackStagingMask: GPUBuffer | null = null
  let readbackStagingRgb: GPUBuffer | null = null
  let currentBufferSize = 0

  // Flag to prevent redundant GPU updates
  const isSavingHistory = ref(false)

  const isDrawing = ref(false)
  const isDrawingLine = ref(false)
  const lineStartPoint = ref<Point | null>(null)
  const lineRemainder = ref(0)
  const smoothingLastDrawTime = ref(new Date())
  const initialDraw = ref(true)

  const dirtyRect = ref<DirtyRect>(resetDirtyRect())

  // Stroke processor instance
  let strokeProcessor: StrokeProcessor | null = null

  const initialPoint = ref<Point | null>(null)
  const useDominantAxis = ref(initialSettings?.useDominantAxis ?? false)
  const brushAdjustmentSpeed = ref(initialSettings?.brushAdjustmentSpeed ?? 1.0)

  const cachedBrushSettings = loadBrushFromCache('maskeditor_brush_settings')
  if (cachedBrushSettings) {
    store.setBrushSize(cachedBrushSettings.size)
    store.setBrushOpacity(cachedBrushSettings.opacity)
    store.setBrushHardness(cachedBrushSettings.hardness)
    store.brushSettings.type = cachedBrushSettings.type
    store.setBrushStepSize(cachedBrushSettings.stepSize ?? 5)
  }

  // Handle external clear events
  watch(
    () => store.clearTrigger,
    () => {
      clearGPU()
    }
  )

  // Sync GPU on Undo/Redo
  watch(
    () => store.canvasHistory.currentStateIndex,
    async () => {
      // Skip update if state was just saved
      if (isSavingHistory.value) return

      // Update GPU textures to match restored canvas state
      await updateGPUFromCanvas()

      // Clear preview to remove artifacts
      if (renderer && previewContext) {
        renderer.clearPreview(previewContext)
      }
    }
  )

  const isRecreatingTextures = ref(false)

  watch(
    () => store.gpuTexturesNeedRecreation,
    async (needsRecreation) => {
      if (
        !needsRecreation ||
        !device ||
        !store.maskCanvas ||
        isRecreatingTextures.value
      )
        return

      isRecreatingTextures.value = true

      const width = store.gpuTextureWidth
      const height = store.gpuTextureHeight

      try {
        // Destroy old textures
        if (maskTexture) {
          maskTexture.destroy()
          maskTexture = null
        }
        if (rgbTexture) {
          rgbTexture.destroy()
          rgbTexture = null
        }

        // Create new textures with updated dimensions
        maskTexture = device.createTexture({
          size: [width, height],
          format: 'rgba8unorm',
          usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.COPY_SRC
        })

        rgbTexture = device.createTexture({
          size: [width, height],
          format: 'rgba8unorm',
          usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.COPY_SRC
        })

        // Upload pending data if available
        if (store.pendingGPUMaskData && store.pendingGPURgbData) {
          device.queue.writeTexture(
            { texture: maskTexture },
            store.pendingGPUMaskData,
            { bytesPerRow: width * 4 },
            { width, height }
          )

          device.queue.writeTexture(
            { texture: rgbTexture },
            store.pendingGPURgbData,
            { bytesPerRow: width * 4 },
            { width, height }
          )
        } else {
          // Fallback: read from canvas
          await updateGPUFromCanvas()
        }

        // Update preview canvas if it exists
        if (previewCanvas && renderer) {
          previewCanvas.width = width
          previewCanvas.height = height
        }

        // Recreate readback buffers with new size
        const bufferSize = width * height * 4
        if (currentBufferSize !== bufferSize) {
          readbackStorageMask?.destroy()
          readbackStorageRgb?.destroy()
          readbackStagingMask?.destroy()
          readbackStagingRgb?.destroy()

          readbackStorageMask = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
          })
          readbackStorageRgb = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
          })
          readbackStagingMask = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          })
          readbackStagingRgb = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          })

          currentBufferSize = bufferSize
        }
      } catch (error) {
        console.error(
          '[useBrushDrawing] Failed to recreate GPU textures:',
          error
        )
      } finally {
        // Clear the recreation flag and pending data
        store.gpuTexturesNeedRecreation = false
        store.gpuTextureWidth = 0
        store.gpuTextureHeight = 0
        store.pendingGPUMaskData = null
        store.pendingGPURgbData = null
        isRecreatingTextures.value = false
      }
    }
  )

  // Cleanup GPU resources on unmount
  onUnmounted(() => {
    if (renderer) {
      renderer.destroy()
      renderer = null
    }
    if (maskTexture) {
      maskTexture.destroy()
      maskTexture = null
    }
    if (rgbTexture) {
      rgbTexture.destroy()
      rgbTexture = null
    }
    if (readbackStorageMask) {
      readbackStorageMask.destroy()
      readbackStorageMask = null
    }
    if (readbackStorageRgb) {
      readbackStorageRgb.destroy()
      readbackStorageRgb = null
    }
    if (readbackStagingMask) {
      readbackStagingMask.destroy()
      readbackStagingMask = null
    }
    if (readbackStagingRgb) {
      readbackStagingRgb.destroy()
      readbackStagingRgb = null
    }
    // We do not destroy the device as it might be shared or managed by TGPU
  })

  /**
   * Initializes the TypeGPU root and device if not already initialized.
   */
  async function initTypeGPU(): Promise<void> {
    if (store.tgpuRoot) {
      device = store.tgpuRoot.device
      return
    }

    try {
      const root = await tgpu.init()
      store.tgpuRoot = root
      device = root.device
      console.warn('✅ TypeGPU initialized! Root:', root)
      console.warn('Device info:', root.device.limits)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('Failed to initialize TypeGPU:', message)
    }
  }

  /**
   * Updates the GPU textures from the current canvas state.
   */
  async function updateGPUFromCanvas(): Promise<void> {
    if (
      !device ||
      !maskTexture ||
      !rgbTexture ||
      !store.maskCanvas ||
      !store.rgbCtx
    )
      return

    const canvasWidth = store.maskCanvas.width
    const canvasHeight = store.maskCanvas.height

    // Upload canvas data to GPU
    const maskImageData = store.maskCtx!.getImageData(
      0,
      0,
      canvasWidth,
      canvasHeight
    )
    premultiplyData(maskImageData.data)
    device.queue.writeTexture(
      { texture: maskTexture },
      maskImageData.data,
      { bytesPerRow: canvasWidth * 4 },
      { width: canvasWidth, height: canvasHeight }
    )

    const rgbImageData = store.rgbCtx.getImageData(
      0,
      0,
      canvasWidth,
      canvasHeight
    )
    premultiplyData(rgbImageData.data)
    device.queue.writeTexture(
      { texture: rgbTexture },
      rgbImageData.data,
      { bytesPerRow: canvasWidth * 4 },
      { width: canvasWidth, height: canvasHeight }
    )
  }

  /**
   * Initializes all GPU resources including textures and the brush renderer.
   */
  async function initGPUResources(): Promise<void> {
    // Initialize TypeGPU
    await initTypeGPU()

    if (!store.tgpuRoot || !device) {
      console.warn('TypeGPU not initialized, skipping GPU resource setup')
      return
    }

    if (
      !store.maskCanvas ||
      !store.rgbCanvas ||
      !store.maskCtx ||
      !store.rgbCtx
    ) {
      console.warn('Canvas contexts not ready, skipping GPU resource setup')
      return
    }

    const canvasWidth = store.maskCanvas!.width
    const canvasHeight = store.maskCanvas!.height

    try {
      console.warn(
        `🎨 Initializing GPU resources for ${canvasWidth}x${canvasHeight} canvas`
      )

      // Create read/write textures
      maskTexture = device.createTexture({
        size: [canvasWidth, canvasHeight],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.COPY_SRC
      })

      rgbTexture = device.createTexture({
        size: [canvasWidth, canvasHeight],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.COPY_SRC
      })

      // Upload initial data
      await updateGPUFromCanvas()

      console.warn('✅ GPU resources initialized successfully')

      const preferredFormat = navigator.gpu.getPreferredCanvasFormat()
      renderer = new GPUBrushRenderer(device!, preferredFormat)
      console.warn('✅ Brush renderer initialized')
    } catch (error) {
      console.error('Failed to initialize GPU resources:', error)
      // Reset to null on failure
      maskTexture = null
      rgbTexture = null
    }
  }

  function drawShape(point: Point, overrideOpacity?: number) {
    const brush = store.brushSettings
    const mask_ctx = store.maskCtx
    const rgb_ctx = store.rgbCtx

    if (!mask_ctx || !rgb_ctx) {
      throw new Error('Canvas contexts are required')
    }

    const brushType = brush.type
    const brushRadius = brush.size
    const hardness = brush.hardness
    const opacity = overrideOpacity ?? brush.opacity
    const effectiveRadius = getEffectiveBrushSize(brushRadius, hardness)
    const effectiveHardness = getEffectiveHardness(
      brushRadius,
      hardness,
      effectiveRadius
    )

    const isErasing = mask_ctx.globalCompositeOperation === 'destination-out'
    const currentTool = store.currentTool
    const isRgbLayer = store.activeLayer === 'rgb'

    if (
      isRgbLayer &&
      currentTool &&
      (currentTool === Tools.Eraser || currentTool === Tools.PaintPen)
    ) {
      drawRgbShape(
        rgb_ctx,
        point,
        brushType,
        effectiveRadius,
        effectiveHardness,
        opacity,
        store.rgbColor
      )
    } else {
      drawMaskShape(
        mask_ctx,
        point,
        brushType,
        effectiveRadius,
        effectiveHardness,
        opacity,
        isErasing,
        store.maskColor
      )
    }

    dirtyRect.value = updateDirtyRect(
      dirtyRect.value,
      point.x,
      point.y,
      effectiveRadius
    )
  }

  /**
   * Draws a point using the stroke processor for smoothing.
   * @param point - The point to draw.
   */
  async function drawWithBetterSmoothing(point: Point): Promise<void> {
    if (!strokeProcessor) return

    // Process point to generate equidistant points
    const newPoints = strokeProcessor.addPoint(point)

    if (newPoints.length === 0) {
      // Update preview even if no points generated to ensure background visibility
      if (renderer && initialDraw.value) {
        gpuRender([], true)
      }
      return
    }

    // Render points on GPU
    if (renderer) {
      gpuRender(newPoints, true) // Skip resampling
    } else {
      // CPU fallback
      for (const p of newPoints) {
        drawShape(p)
      }
    }

    initialDraw.value = false
  }

  /**
   * Initializes the canvas context for a new shape.
   * @param compositionOperation - The composition operation to use.
   */
  function initShape(compositionOperation: CompositionOperation) {
    const blendMode = store.maskBlendMode
    const mask_ctx = store.maskCtx
    const rgb_ctx = store.rgbCtx

    if (!mask_ctx || !rgb_ctx) {
      throw new Error('Canvas contexts are required')
    }

    mask_ctx.beginPath()
    rgb_ctx.beginPath()

    if (compositionOperation === CompositionOperation.SourceOver) {
      mask_ctx.fillStyle = blendMode
      mask_ctx.globalCompositeOperation = CompositionOperation.SourceOver
      rgb_ctx.globalCompositeOperation = CompositionOperation.SourceOver
    } else if (compositionOperation === CompositionOperation.DestinationOut) {
      mask_ctx.globalCompositeOperation = CompositionOperation.DestinationOut
      rgb_ctx.globalCompositeOperation = CompositionOperation.DestinationOut
    }
  }

  /**
   * Draws a line between two points.
   * @param p1 - Start point.
   * @param p2 - End point.
   * @param compositionOp - Composition operation.
   * @param spacing - Spacing between points.
   */
  async function drawLine(
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation,
    spacing: number
  ): Promise<void> {
    // Generate equidistant points using segment resampling
    const { points, remainder } = resampleSegment(
      [p1, p2],
      spacing,
      lineRemainder.value
    )

    lineRemainder.value = remainder

    // Ensure context state is initialized (sets globalCompositeOperation for isErasing checks)
    initShape(compositionOp)

    if (renderer) {
      gpuRender(points)
    } else {
      // CPU fallback
      for (const point of points) {
        drawShape(point, 1) // Opacity handled by brush texture
      }
    }
  }

  /**
   * Starts the drawing process.
   * @param event - The pointer event.
   */
  async function startDrawing(event: PointerEvent): Promise<void> {
    isDrawing.value = true
    dirtyRect.value = resetDirtyRect()

    try {
      // Initialize stroke accumulator
      if (renderer && store.maskCanvas) {
        renderer.prepareStroke(store.maskCanvas.width, store.maskCanvas.height)
      }

      let compositionOp: CompositionOperation
      const currentTool = store.currentTool
      const coords = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = coordinateTransform.screenToCanvas(coords)

      if (currentTool === 'eraser' || event.buttons === 2) {
        compositionOp = CompositionOperation.DestinationOut
      } else {
        compositionOp = CompositionOperation.SourceOver
      }

      // Calculate target spacing based on step size percentage
      const stepPercentage =
        Math.pow(100, store.brushSettings.stepSize / 100) / 100
      const targetSpacing = Math.max(
        1.0,
        store.brushSettings.size * stepPercentage
      )

      if (event.shiftKey && lineStartPoint.value) {
        isDrawingLine.value = true
        await drawLine(
          lineStartPoint.value,
          coords_canvas,
          compositionOp,
          targetSpacing
        )
      } else {
        isDrawingLine.value = false
        initShape(compositionOp)
        // Reset remainder
        lineRemainder.value = targetSpacing
      }

      lineStartPoint.value = coords_canvas

      // Hide main canvas to prevent double rendering
      if (renderer) {
        const isRgb = store.activeLayer === 'rgb'
        if (isRgb && store.rgbCanvas) {
          store.rgbCanvas.style.opacity = '0'
          if (previewCanvas) previewCanvas.style.opacity = '1'
        } else if (!isRgb && store.maskCanvas) {
          store.maskCanvas.style.opacity = '0'
          if (previewCanvas)
            previewCanvas.style.opacity = String(store.maskOpacity)
        }
      }

      // Initialize stroke processor
      strokeProcessor = new StrokeProcessor(targetSpacing)

      // Process first point
      await drawWithBetterSmoothing(coords_canvas)

      smoothingLastDrawTime.value = new Date()
    } catch (error) {
      console.error('[useBrushDrawing] Failed to start drawing:', error)

      isDrawing.value = false
      isDrawingLine.value = false
    }
  }

  /**
   * Handles the drawing movement.
   * @param event - The pointer event.
   */
  async function handleDrawing(event: PointerEvent): Promise<void> {
    const diff = performance.now() - smoothingLastDrawTime.value.getTime()
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)
    const currentTool = store.currentTool

    if (diff > 20 && !isDrawing.value) {
      requestAnimationFrame(async () => {
        if (!isDrawing.value) return // Fix: Prevent race condition
        try {
          initShape(CompositionOperation.SourceOver)
          await gpuDrawPoint(coords_canvas)
          // smoothingCordsArray.value.push(coords_canvas) // Removed in favor of StrokeProcessor
        } catch (error) {
          console.error('[useBrushDrawing] Drawing error:', error)
        }
      })
    } else {
      requestAnimationFrame(async () => {
        if (!isDrawing.value) return // Fix: Prevent race condition
        try {
          if (currentTool === 'eraser' || event.buttons === 2) {
            initShape(CompositionOperation.DestinationOut)
          } else {
            initShape(CompositionOperation.SourceOver)
          }
          await drawWithBetterSmoothing(coords_canvas)
        } catch (error) {
          console.error('[useBrushDrawing] Drawing error:', error)
        }
      })
    }

    smoothingLastDrawTime.value = new Date()
  }

  /**
   * Ends the drawing process.
   * @param event - The pointer event.
   */
  async function drawEnd(event: PointerEvent): Promise<void> {
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    if (isDrawing.value) {
      isDrawing.value = false

      lineStartPoint.value = coords_canvas
      initialDraw.value = true

      // Flush remaining points from StrokeProcessor
      if (strokeProcessor) {
        const finalPoints = strokeProcessor.endStroke()
        if (finalPoints.length > 0) {
          if (renderer) {
            gpuRender(finalPoints, true)
          } else {
            for (const p of finalPoints) {
              drawShape(p)
            }
          }
        }
        strokeProcessor = null
      }

      // Composite the stroke accumulator into the main texture
      if (renderer && maskTexture && rgbTexture) {
        const isRgb = store.activeLayer === 'rgb'
        const targetTex = isRgb ? rgbTexture : maskTexture

        // Use the actual brush opacity for the composite pass
        const size = store.brushSettings.size
        const hardness = store.brushSettings.hardness
        const effectiveSize = getEffectiveBrushSize(size, hardness)
        const effectiveHardness = getEffectiveHardness(
          size,
          hardness,
          effectiveSize
        )

        const isErasing =
          store.currentTool === 'eraser' ||
          store.maskCtx?.globalCompositeOperation === 'destination-out'

        const brushShape = store.brushSettings.type === BrushShape.Rect ? 1 : 0

        renderer.compositeStroke(targetTex.createView(), {
          opacity: store.brushSettings.opacity,
          color: [0, 0, 0], // Color is handled by accumulator, this is just for uniforms if needed
          hardness: effectiveHardness,
          screenSize: [store.maskCanvas!.width, store.maskCanvas!.height],
          brushShape,
          isErasing
        })
      }

      let maskData: ImageData | undefined
      let rgbData: ImageData | undefined

      if (renderer && maskTexture && rgbTexture) {
        try {
          const result = await copyGpuToCanvas()
          maskData = result.maskData
          rgbData = result.rgbData
        } catch (error) {
          console.warn('GPU readback failed, falling back to CPU:', error)
        }
      }

      isSavingHistory.value = true
      store.canvasHistory.saveState(maskData, rgbData)
      // Wait for watcher to trigger (if any) before clearing flag
      await nextTick()

      isSavingHistory.value = false

      // Fix: Clear the preview canvas when drawing ends
      if (renderer && previewContext) {
        renderer.clearPreview(previewContext)
      }

      // Restore main canvas visibility
      if (store.activeLayer === 'rgb' && store.rgbCanvas) {
        store.rgbCanvas.style.opacity = '1'
      } else if (store.activeLayer === 'mask' && store.maskCanvas) {
        store.maskCanvas.style.opacity = String(store.maskOpacity)
      }

      // Reset preview canvas opacity to 1 (for hover preview)
      if (previewCanvas) {
        previewCanvas.style.opacity = '1'
      }
    }
  }

  /**
   * Starts the brush adjustment interaction.
   * @param event - The pointer event.
   */
  async function startBrushAdjustment(event: PointerEvent): Promise<void> {
    event.preventDefault()

    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    store.brushPreviewGradientVisible = true
    initialPoint.value = coords_canvas
  }

  /**
   * Handles the brush adjustment movement.
   * @param event - The pointer event.
   */
  async function handleBrushAdjustment(event: PointerEvent): Promise<void> {
    if (!initialPoint.value) {
      return
    }

    const coords = { x: event.offsetX, y: event.offsetY }
    const brushDeadZone = 5
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    const delta_x = coords_canvas.x - initialPoint.value.x
    const delta_y = coords_canvas.y - initialPoint.value.y

    const effectiveDeltaX = Math.abs(delta_x) < brushDeadZone ? 0 : delta_x
    const effectiveDeltaY = Math.abs(delta_y) < brushDeadZone ? 0 : delta_y

    let finalDeltaX = effectiveDeltaX
    let finalDeltaY = effectiveDeltaY

    if (useDominantAxis.value) {
      const ratio = Math.abs(effectiveDeltaX) / Math.abs(effectiveDeltaY)
      const threshold = 2.0

      if (ratio > threshold) {
        finalDeltaY = 0
      } else if (ratio < 1 / threshold) {
        finalDeltaX = 0
      }
    }

    const cappedDeltaX = Math.max(-100, Math.min(100, finalDeltaX))
    const cappedDeltaY = Math.max(-100, Math.min(100, finalDeltaY))

    const newSize = Math.max(
      1,
      Math.min(
        500,
        store.brushSettings.size +
          (cappedDeltaX / 35) * brushAdjustmentSpeed.value
      )
    )

    const newHardness = Math.max(
      0,
      Math.min(
        1,
        store.brushSettings.hardness -
          (cappedDeltaY / 4000) * brushAdjustmentSpeed.value
      )
    )

    store.setBrushSize(newSize)
    store.setBrushHardness(newHardness)
  }

  /**
   * Saves the current brush settings to cache.
   */
  function saveBrushSettings(): void {
    saveBrushToCache('maskeditor_brush_settings', store.brushSettings)
  }

  /**
   * Reads back the GPU textures to CPU ImageDatas.
   * @returns Object containing mask and rgb ImageDatas.
   */
  async function copyGpuToCanvas(): Promise<{
    maskData: ImageData
    rgbData: ImageData
  }> {
    if (
      !device ||
      !maskTexture ||
      !rgbTexture ||
      !store.maskCanvas ||
      !store.rgbCanvas ||
      !store.maskCtx ||
      !store.rgbCtx ||
      !renderer
    )
      throw new Error('GPU resources not ready')

    const width = store.maskCanvas.width
    const height = store.maskCanvas.height
    const bufferSize = width * height * 4

    // 1. Initialize/Resize Buffers if needed
    if (
      !readbackStorageMask ||
      !readbackStorageRgb ||
      !readbackStagingMask ||
      !readbackStagingRgb ||
      currentBufferSize !== bufferSize
    ) {
      // Destroy old buffers if they exist
      readbackStorageMask?.destroy()
      readbackStorageRgb?.destroy()
      readbackStagingMask?.destroy()
      readbackStagingRgb?.destroy()

      // Create Storage Buffers (for compute shader output)
      readbackStorageMask = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      })
      readbackStorageRgb = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      })

      // Create Staging Buffers (for reading back)
      readbackStagingMask = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      })
      readbackStagingRgb = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      })

      currentBufferSize = bufferSize
    }

    // 2. Run Compute Shaders (Un-premultiply and pack)
    renderer.prepareReadback(maskTexture, readbackStorageMask)
    renderer.prepareReadback(rgbTexture, readbackStorageRgb)

    // 3. Copy Storage -> Staging
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(
      readbackStorageMask,
      0,
      readbackStagingMask,
      0,
      bufferSize
    )
    encoder.copyBufferToBuffer(
      readbackStorageRgb,
      0,
      readbackStagingRgb,
      0,
      bufferSize
    )
    device.queue.submit([encoder.finish()])

    // 4. Map Staging Buffers
    await Promise.all([
      readbackStagingMask.mapAsync(GPUMapMode.READ),
      readbackStagingRgb.mapAsync(GPUMapMode.READ)
    ])

    // 5. Read Data & Update Canvas
    // We use slice(0) to copy data because unmap() invalidates the array
    const maskDataArr = new Uint8ClampedArray(
      readbackStagingMask.getMappedRange().slice(0)
    )
    const rgbDataArr = new Uint8ClampedArray(
      readbackStagingRgb.getMappedRange().slice(0)
    )

    // Unmap immediately after copying
    readbackStagingMask.unmap()
    readbackStagingRgb.unmap()

    const maskImageData = new ImageData(maskDataArr, width, height)
    const rgbImageData = new ImageData(rgbDataArr, width, height)

    // Calculate Dirty Rect
    let dx = 0
    let dy = 0
    let dw = width
    let dh = height

    if (
      dirtyRect.value.minX !== Infinity &&
      dirtyRect.value.maxX !== -Infinity
    ) {
      const r = dirtyRect.value
      dx = Math.floor(Math.max(0, r.minX))
      dy = Math.floor(Math.max(0, r.minY))
      const max_x = Math.ceil(Math.min(width, r.maxX))
      const max_y = Math.ceil(Math.min(height, r.maxY))
      dw = max_x - dx
      dh = max_y - dy
    }

    // Ensure valid dimensions
    if (dw > 0 && dh > 0) {
      store.maskCtx.putImageData(maskImageData, 0, 0, dx, dy, dw, dh)
      store.rgbCtx.putImageData(rgbImageData, 0, 0, dx, dy, dw, dh)
    } else {
      // Fallback to full update if rect is invalid (shouldn't happen if drawn)
      store.maskCtx.putImageData(maskImageData, 0, 0)
      store.rgbCtx.putImageData(rgbImageData, 0, 0)
    }

    return { maskData: maskImageData, rgbData: rgbImageData }
  }

  /**
   * Cleans up GPU resources and buffers.
   */
  function destroy(): void {
    renderer?.destroy()
    if (maskTexture) {
      maskTexture.destroy()
      maskTexture = null
    }
    if (rgbTexture) {
      rgbTexture.destroy()
      rgbTexture = null
    }
    // Cleanup Readback Buffers
    readbackStorageMask?.destroy()
    readbackStorageRgb?.destroy()
    readbackStagingMask?.destroy()
    readbackStagingRgb?.destroy()
    readbackStorageMask = null
    readbackStorageRgb = null
    readbackStagingMask = null
    readbackStagingRgb = null
    currentBufferSize = 0

    if (store.tgpuRoot) {
      store.tgpuRoot.destroy()
      store.tgpuRoot = null
    }
    device = null
  }

  /**
   * Draws a single point using the GPU renderer.
   * @param point - The point to draw.
   * @param opacity - The opacity of the point.
   */
  async function gpuDrawPoint(point: Point, opacity: number = 1) {
    if (renderer) {
      const width = store.maskCanvas!.width
      const height = store.maskCanvas!.height
      const strokePoints = [{ x: point.x, y: point.y, pressure: opacity }]

      const size = store.brushSettings.size
      const hardness = store.brushSettings.hardness
      const effectiveSize = getEffectiveBrushSize(size, hardness)
      const effectiveHardness = getEffectiveHardness(
        size,
        hardness,
        effectiveSize
      )

      const brushShape = store.brushSettings.type === BrushShape.Rect ? 1 : 0

      // Use accumulator with fixed high opacity to build shape
      renderer.renderStrokeToAccumulator(strokePoints, {
        size: effectiveSize,
        opacity: 0.5, // Fixed flow for smooth accumulation
        hardness: effectiveHardness,
        color: [1, 1, 1],
        width,
        height,
        brushShape
      })

      // Update preview with correct settings
      if (maskTexture && previewContext) {
        const isRgb = store.activeLayer === 'rgb'
        let color: [number, number, number] = [1, 1, 1]
        if (isRgb) {
          const c = parseToRgb(store.rgbColor)
          color = [c.r / 255, c.g / 255, c.b / 255]
        } else {
          const c = store.maskColor as { r: number; g: number; b: number }
          color = [c.r / 255, c.g / 255, c.b / 255]
        }

        const isErasing =
          store.currentTool === 'eraser' ||
          store.maskCtx?.globalCompositeOperation === 'destination-out'

        renderer.blitToCanvas(
          previewContext,
          {
            opacity: store.brushSettings.opacity,
            color,
            hardness: effectiveHardness,
            screenSize: [width, height],
            brushShape,
            isErasing
          },
          undefined // Do not draw background texture for preview to avoid double rendering
        )
      }
    } else {
      drawShape(point, opacity)
    }
  }

  /**
   * Initializes the preview canvas context for WebGPU.
   * @param canvas - The canvas element.
   */
  function initPreviewCanvas(canvas: HTMLCanvasElement) {
    if (!device) return

    const ctx = canvas.getContext('webgpu')
    if (!ctx) return

    ctx.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied'
    })
    previewContext = ctx
    previewCanvas = canvas
    console.warn('✅ Preview Canvas Initialized')
  }

  /**
   * Renders a set of points using the GPU.
   * @param points - The points to render.
   * @param skipResampling - Whether to skip resampling (if points are already spaced).
   */
  function gpuRender(points: Point[], skipResampling: boolean = false) {
    if (!renderer || !maskTexture || !rgbTexture) return

    const isRgb = store.activeLayer === 'rgb'

    // 1. Get Correct Color
    let color: [number, number, number] = [1, 1, 1]
    if (isRgb) {
      const c = parseToRgb(store.rgbColor)
      color = [c.r / 255, c.g / 255, c.b / 255]
    } else {
      // Mask color - properly typed
      const c = store.maskColor as { r: number; g: number; b: number }
      color = [c.r / 255, c.g / 255, c.b / 255]
    }

    // 2. Prepare stroke points
    let strokePoints: { x: number; y: number; pressure: number }[] = []

    if (skipResampling) {
      // Points are already properly spaced from Catmull-Rom spline interpolation
      strokePoints = points.map((p) => ({ x: p.x, y: p.y, pressure: 1.0 }))
    } else {
      // Legacy resampling for shift+click and other cases
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i]
        const p2 = points[i + 1]
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)

        // Calculate target spacing based on stepSize
        const stepPercentage =
          Math.pow(100, store.brushSettings.stepSize / 100) / 100
        const stepSize = Math.max(
          1.0,
          store.brushSettings.size * stepPercentage
        )
        const steps = Math.max(1, Math.ceil(dist / stepSize))

        for (let step = 0; step <= steps; step++) {
          const t = step / steps
          const pressure = 1.0

          const x = p1.x + (p2.x - p1.x) * t
          const y = p1.y + (p2.y - p1.y) * t

          strokePoints.push({ x, y, pressure })
        }
      }
    }

    // Render to Accumulator (SourceOver blending)
    // Use fixed opacity (0.5) to build up the shape smoothly without creases.
    // The final opacity is applied in the composite pass.
    const size = store.brushSettings.size
    const hardness = store.brushSettings.hardness
    const effectiveSize = getEffectiveBrushSize(size, hardness)
    const effectiveHardness = getEffectiveHardness(
      size,
      hardness,
      effectiveSize
    )

    const brushShape = store.brushSettings.type === BrushShape.Rect ? 1 : 0

    // Render to Accumulator (SourceOver blending)
    // Use fixed opacity (0.5) to build up the shape smoothly without creases.
    // The final opacity is applied in the composite pass.
    renderer.renderStrokeToAccumulator(strokePoints, {
      size: effectiveSize,
      opacity: 0.5,
      hardness: effectiveHardness,
      color: color,
      width: store.maskCanvas!.width,
      height: store.maskCanvas!.height,
      brushShape
    })

    for (const p of strokePoints) {
      dirtyRect.value = updateDirtyRect(
        dirtyRect.value,
        p.x,
        p.y,
        effectiveSize
      )
    }

    // 3. Blit to Preview with correct settings
    if (previewContext) {
      const isErasing =
        store.currentTool === 'eraser' ||
        store.maskCtx?.globalCompositeOperation === 'destination-out'

      const targetTex = isRgb ? rgbTexture : maskTexture
      renderer.blitToCanvas(
        previewContext,
        {
          opacity: store.brushSettings.opacity,
          color,
          hardness: effectiveHardness,
          screenSize: [store.maskCanvas!.width, store.maskCanvas!.height],
          brushShape,
          isErasing
        },
        targetTex ?? undefined
      )
    }
  }

  /**
   * Clears the GPU textures.
   */
  function clearGPU() {
    if (!device || !maskTexture || !rgbTexture || !store.maskCanvas) return

    const width = store.maskCanvas.width
    const height = store.maskCanvas.height

    // Clear Mask Texture
    device.queue.writeTexture(
      { texture: maskTexture },
      new Uint8Array(width * height * 4), // Zeros
      { bytesPerRow: width * 4 },
      { width, height }
    )

    // Clear RGB Texture
    device.queue.writeTexture(
      { texture: rgbTexture },
      new Uint8Array(width * height * 4), // Zeros
      { bytesPerRow: width * 4 },
      { width, height }
    )
  }

  return {
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment,
    handleBrushAdjustment,
    saveBrushSettings,
    destroy,
    initGPUResources,
    initPreviewCanvas,
    clearGPU // Export this
  }
}
