import { nextTick, ref } from 'vue'
import { useEventListener } from '@vueuse/core'

import { CompositionOperation, Tools } from './types'
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { useMaskEditorStore } from './maskEditorStore'

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
import { useCoordinateTransform } from './useCoordinateTransform'

export function useBrushDrawing(initialSettings?: {
  useDominantAxis?: boolean
  brushAdjustmentSpeed?: number
}) {
  const store = useMaskEditorStore()
  const coordinateTransform = useCoordinateTransform()
  const { startBrushAdjustment, handleBrushAdjustment } =
    useBrushAdjustment(initialSettings)
  const gpu = useGPUResources()

  const isDrawingLine = ref(false)
  const lineStartPoint = ref<Point | null>(null)
  const lineRemainder = ref(0)
  const initialDraw = ref(true)

  let strokeProcessor: StrokeProcessor | null = null
  let drawingPointerId: number | undefined

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
    } else {
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
    if (drawingPointerId !== undefined) return
    drawingPointerId = event.pointerId
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

      if (gpu.hasRenderer.value && gpu.previewCanvas.value) {
        /* c8 ignore start */
        const isRgb = store.activeLayer === 'rgb'
        if (isRgb && store.rgbCanvas) {
          store.rgbCanvas.style.opacity = '0'
          gpu.previewCanvas.value.style.opacity = '1'
        } else if (!isRgb && store.maskCanvas) {
          store.maskCanvas.style.opacity = '0'
          gpu.previewCanvas.value.style.opacity = String(store.maskOpacity)
        }
        /* c8 ignore stop */
      }

      strokeProcessor = new StrokeProcessor(targetSpacing)
      await drawWithBetterSmoothing(coords_canvas)
    } catch (error) {
      /* c8 ignore start */
      const isRgb = store.activeLayer === 'rgb'
      if (isRgb && store.rgbCanvas) store.rgbCanvas.style.opacity = '1'
      else if (!isRgb && store.maskCanvas)
        store.maskCanvas.style.opacity = String(store.maskOpacity)
      if (gpu.previewCanvas.value) gpu.previewCanvas.value.style.opacity = '1'
      gpu.clearPreview()
      /* c8 ignore stop */
      console.error('[useBrushDrawing] Failed to start drawing:', error)
      drawingPointerId = undefined
      isDrawingLine.value = false
    }
  }

  async function handleDrawing(event: PointerEvent): Promise<void> {
    if (event.pointerId !== drawingPointerId) return

    const activeStroke = strokeProcessor
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)
    const currentTool = store.currentTool

    requestAnimationFrame(async () => {
      if (
        event.pointerId !== drawingPointerId ||
        activeStroke !== strokeProcessor
      )
        return
      try {
        const compositionOp =
          currentTool === 'eraser' || event.buttons === 2
            ? CompositionOperation.DestinationOut
            : CompositionOperation.SourceOver
        initShape(compositionOp)
        await drawWithBetterSmoothing(coords_canvas)
      } catch (error) {
        console.error('[useBrushDrawing] Drawing error:', error)
      }
    })
  }

  async function drawEnd(event: PointerEvent): Promise<void> {
    if (drawingPointerId === undefined || event.pointerId !== drawingPointerId)
      return

    const rect = store.pointerZone?.getBoundingClientRect()
    const coords = rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    drawingPointerId = undefined
    lineStartPoint.value = coords_canvas
    initialDraw.value = true

    const completedStroke = strokeProcessor
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
    }

    const isRgb = store.activeLayer === 'rgb'
    const isErasing =
      store.currentTool === 'eraser' ||
      store.maskCtx?.globalCompositeOperation === 'destination-out'
    gpu.compositeStroke(isRgb, isErasing)

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

    gpu.isSavingHistory.value = true
    try {
      store.canvasHistory.saveState(maskData, rgbData)
      await nextTick()
    } finally {
      gpu.isSavingHistory.value = false
    }

    if (strokeProcessor !== completedStroke) return
    strokeProcessor = null
    gpu.clearPreview()

    if (isRgb && store.rgbCanvas) {
      store.rgbCanvas.style.opacity = '1'
    } else if (!isRgb && store.maskCanvas) {
      store.maskCanvas.style.opacity = String(store.maskOpacity)
    }
    if (gpu.previewCanvas.value) {
      gpu.previewCanvas.value.style.opacity = '1'
    }
  }

  useEventListener(window, ['pointerup', 'pointercancel'], drawEnd, {
    capture: true
  })

  return {
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment,
    handleBrushAdjustment,
    destroy: gpu.destroy,
    initGPUResources: gpu.initGPUResources,
    initPreviewCanvas: gpu.initPreviewCanvas,
    clearGPU: gpu.clearGPU
  }
}
