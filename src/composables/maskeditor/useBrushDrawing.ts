import { nextTick, ref } from 'vue'

import { CompositionOperation, Tools } from '@/extensions/core/maskeditor/types'
import type { Point } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import {
  drawMaskShape,
  drawRgbShape,
  resetDirtyRect,
  updateDirtyRect
} from './brushDrawingUtils'
import { getEffectiveBrushSize, getEffectiveHardness } from './brushUtils'
import { resampleSegment } from './splineUtils'
import { StrokeProcessor } from './StrokeProcessor'
import { useBrushAdjustment } from './useBrushAdjustment'
import { useGPUResources } from './useGPUResources'
import { useBrushPersistence } from './useBrushPersistence'
import { useCoordinateTransform } from './useCoordinateTransform'

export function useBrushDrawing(initialSettings?: {
  useDominantAxis?: boolean
  brushAdjustmentSpeed?: number
}) {
  const store = useMaskEditorStore()
  const coordinateTransform = useCoordinateTransform()
  const persistence = useBrushPersistence()
  const { startBrushAdjustment, handleBrushAdjustment } =
    useBrushAdjustment(initialSettings)
  const gpu = useGPUResources()

  const isDrawing = ref(false)
  const isDrawingLine = ref(false)
  const lineStartPoint = ref<Point | null>(null)
  const lineRemainder = ref(0)
  const smoothingLastDrawTime = ref(new Date())
  const initialDraw = ref(true)

  let strokeProcessor: StrokeProcessor | null = null

  persistence.loadAndApply()

  // ── CPU drawing path ─────────────────────────────────────────────────────────

  function drawShape(point: Point, overrideOpacity?: number) {
    const brush = store.brushSettings
    const mask_ctx = store.maskCtx
    const rgb_ctx = store.rgbCtx

    if (!mask_ctx || !rgb_ctx) throw new Error('Canvas contexts are required')

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
        brush.type,
        effectiveRadius,
        effectiveHardness,
        opacity,
        store.rgbColor
      )
    } else {
      drawMaskShape(
        mask_ctx,
        point,
        brush.type,
        effectiveRadius,
        effectiveHardness,
        opacity,
        isErasing,
        store.maskColor
      )
    }

    gpu.dirtyRect.value = updateDirtyRect(
      gpu.dirtyRect.value,
      point.x,
      point.y,
      effectiveRadius
    )
  }

  // ── Drawing orchestration ────────────────────────────────────────────────────

  function initShape(compositionOperation: CompositionOperation) {
    const blendMode = store.maskBlendMode
    const mask_ctx = store.maskCtx
    const rgb_ctx = store.rgbCtx

    if (!mask_ctx || !rgb_ctx) throw new Error('Canvas contexts are required')

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

  async function drawWithBetterSmoothing(point: Point): Promise<void> {
    if (!strokeProcessor) return

    const newPoints = strokeProcessor.addPoint(point)

    if (newPoints.length === 0) {
      if (gpu.hasRenderer.value && initialDraw.value) {
        /* c8 ignore next */
        gpu.gpuRender([], true)
      }
      return
    }

    if (gpu.hasRenderer.value) {
      /* c8 ignore next */
      gpu.gpuRender(newPoints, true)
    } else {
      for (const p of newPoints) drawShape(p)
    }

    initialDraw.value = false
  }

  async function drawLine(
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation,
    spacing: number
  ): Promise<void> {
    const { points, remainder } = resampleSegment(
      [p1, p2],
      spacing,
      lineRemainder.value
    )
    lineRemainder.value = remainder
    initShape(compositionOp)

    if (gpu.hasRenderer.value) {
      /* c8 ignore next */
      gpu.gpuRender(points)
    } else {
      for (const point of points) drawShape(point, 1)
    }
  }

  async function startDrawing(event: PointerEvent): Promise<void> {
    isDrawing.value = true
    gpu.dirtyRect.value = resetDirtyRect()

    try {
      gpu.prepareStroke()

      const currentTool = store.currentTool
      const coords = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = coordinateTransform.screenToCanvas(coords)

      const compositionOp =
        currentTool === 'eraser' || event.buttons === 2
          ? CompositionOperation.DestinationOut
          : CompositionOperation.SourceOver

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
        lineRemainder.value = targetSpacing
      }

      lineStartPoint.value = coords_canvas

      if (gpu.hasRenderer.value) {
        /* c8 ignore start */
        const isRgb = store.activeLayer === 'rgb'
        if (isRgb && store.rgbCanvas) {
          store.rgbCanvas.style.opacity = '0'
          if (gpu.previewCanvas.value)
            gpu.previewCanvas.value.style.opacity = '1'
        } else if (!isRgb && store.maskCanvas) {
          store.maskCanvas.style.opacity = '0'
          if (gpu.previewCanvas.value)
            gpu.previewCanvas.value.style.opacity = String(store.maskOpacity)
        }
        /* c8 ignore stop */
      }

      strokeProcessor = new StrokeProcessor(targetSpacing)
      await drawWithBetterSmoothing(coords_canvas)
      smoothingLastDrawTime.value = new Date()
    } catch (error) {
      console.error('[useBrushDrawing] Failed to start drawing:', error)
      isDrawing.value = false
      isDrawingLine.value = false
    }
  }

  async function handleDrawing(event: PointerEvent): Promise<void> {
    const diff = performance.now() - smoothingLastDrawTime.value.getTime()
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)
    const currentTool = store.currentTool

    if (diff > 20 && !isDrawing.value) {
      requestAnimationFrame(async () => {
        if (!isDrawing.value) return
        try {
          initShape(CompositionOperation.SourceOver)
          if (gpu.hasRenderer.value) {
            await gpu.gpuDrawPoint(coords_canvas)
          } else {
            drawShape(coords_canvas)
          }
        } catch (error) {
          console.error('[useBrushDrawing] Drawing error:', error)
        }
      })
    } else {
      requestAnimationFrame(async () => {
        if (!isDrawing.value) return
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

  async function drawEnd(event: PointerEvent): Promise<void> {
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    if (!isDrawing.value) return

    isDrawing.value = false
    lineStartPoint.value = coords_canvas
    initialDraw.value = true

    // Flush remaining stroke points
    if (strokeProcessor) {
      const finalPoints = strokeProcessor.endStroke()
      if (finalPoints.length > 0) {
        if (gpu.hasRenderer.value) {
          /* c8 ignore next */
          gpu.gpuRender(finalPoints, true)
        } else {
          for (const p of finalPoints) drawShape(p)
        }
      }
      strokeProcessor = null
    }

    // Composite GPU stroke into the main texture
    const isRgb = store.activeLayer === 'rgb'
    const isErasing =
      store.currentTool === 'eraser' ||
      store.maskCtx?.globalCompositeOperation === 'destination-out'
    gpu.compositeStroke(isRgb, isErasing)

    // Read back GPU result
    let maskData: ImageData | undefined
    let rgbData: ImageData | undefined
    if (gpu.hasRenderer.value) {
      /* c8 ignore start */
      try {
        const result = await gpu.copyGpuToCanvas()
        maskData = result.maskData
        rgbData = result.rgbData
      } catch (error) {
        console.warn('GPU readback failed, falling back to CPU:', error)
      }
      /* c8 ignore stop */
    }

    // Save to history
    gpu.isSavingHistory.value = true
    try {
      store.canvasHistory.saveState(maskData, rgbData)
      await nextTick()
    } finally {
      gpu.isSavingHistory.value = false
    }

    gpu.clearPreview()

    // Restore canvas visibility
    if (isRgb && store.rgbCanvas) {
      store.rgbCanvas.style.opacity = '1'
    } else if (!isRgb && store.maskCanvas) {
      store.maskCanvas.style.opacity = String(store.maskOpacity)
    }
    if (gpu.previewCanvas.value) {
      gpu.previewCanvas.value.style.opacity = '1'
    }
  }

  return {
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment,
    handleBrushAdjustment,
    saveBrushSettings: persistence.save,
    destroy: gpu.destroy,
    initGPUResources: gpu.initGPUResources,
    initPreviewCanvas: gpu.initPreviewCanvas,
    clearGPU: gpu.clearGPU
  }
}
