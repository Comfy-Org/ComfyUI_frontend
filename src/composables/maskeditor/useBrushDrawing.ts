import { ref } from 'vue'
import QuickLRU from '@alloc/quick-lru'
import { debounce } from 'es-toolkit/compat'
import { hexToRgb, parseToRgb } from '@/utils/colorUtil'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import {
  Tools,
  BrushShape,
  CompositionOperation
} from '@/extensions/core/maskeditor/types'
import type { Brush, Point } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useCoordinateTransform } from './useCoordinateTransform'

const saveBrushToCache = debounce(function (key: string, brush: Brush): void {
  try {
    const brushString = JSON.stringify(brush)
    setStorageValue(key, brushString)
  } catch (error) {
    console.error('Failed to save brush to cache:', error)
  }
}, 300)

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

  const brushTextureCache = new QuickLRU<string, HTMLCanvasElement>({
    maxSize: 8
  })

  const SMOOTHING_MAX_STEPS = 30
  const SMOOTHING_MIN_STEPS = 2

  const isDrawing = ref(false)
  const isDrawingLine = ref(false)
  const lineStartPoint = ref<Point | null>(null)
  const smoothingCordsArray = ref<Point[]>([])
  const smoothingLastDrawTime = ref(new Date())
  const initialDraw = ref(true)

  const brushStrokeCanvas = ref<HTMLCanvasElement | null>(null)
  const brushStrokeCtx = ref<CanvasRenderingContext2D | null>(null)

  const initialPoint = ref<Point | null>(null)
  const useDominantAxis = ref(initialSettings?.useDominantAxis ?? false)
  const brushAdjustmentSpeed = ref(initialSettings?.brushAdjustmentSpeed ?? 1.0)

  const cachedBrushSettings = loadBrushFromCache('maskeditor_brush_settings')
  if (cachedBrushSettings) {
    store.setBrushSize(cachedBrushSettings.size)
    store.setBrushOpacity(cachedBrushSettings.opacity)
    store.setBrushHardness(cachedBrushSettings.hardness)
    store.brushSettings.type = cachedBrushSettings.type
    store.setBrushSmoothingPrecision(cachedBrushSettings.smoothingPrecision)
  }

  const createBrushStrokeCanvas = async (): Promise<void> => {
    if (brushStrokeCanvas.value !== null) {
      return
    }

    const maskCanvas = store.maskCanvas
    if (!maskCanvas) {
      throw new Error('Mask canvas not initialized')
    }

    const canvas = document.createElement('canvas')
    canvas.width = maskCanvas.width
    canvas.height = maskCanvas.height

    brushStrokeCanvas.value = canvas
    brushStrokeCtx.value = canvas.getContext('2d')!
  }

  const initShape = (compositionOperation: CompositionOperation) => {
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

  const formatRgba = (hex: string, alpha: number): string => {
    const { r, g, b } = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const getCachedBrushTexture = (
    radius: number,
    hardness: number,
    color: string,
    opacity: number
  ): HTMLCanvasElement => {
    const cacheKey = `${radius}_${hardness}_${color}_${opacity}`

    if (brushTextureCache.has(cacheKey)) {
      return brushTextureCache.get(cacheKey)!
    }

    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')!
    const size = radius * 2
    tempCanvas.width = size
    tempCanvas.height = size

    const centerX = size / 2
    const centerY = size / 2
    const hardRadius = radius * hardness

    const imageData = tempCtx.createImageData(size, size)
    const data = imageData.data
    const { r, g, b } = parseToRgb(color)

    const fadeRange = radius - hardRadius

    for (let y = 0; y < size; y++) {
      const dy = y - centerY
      for (let x = 0; x < size; x++) {
        const dx = x - centerX
        const index = (y * size + x) * 4

        // Calculate square distance (Chebyshev distance)
        const distFromEdge = Math.max(Math.abs(dx), Math.abs(dy))

        let pixelOpacity = 0
        if (distFromEdge <= hardRadius) {
          pixelOpacity = opacity
        } else if (distFromEdge <= radius) {
          const fadeProgress = (distFromEdge - hardRadius) / fadeRange
          pixelOpacity = opacity * (1 - fadeProgress)
        }

        data[index] = r
        data[index + 1] = g
        data[index + 2] = b
        data[index + 3] = pixelOpacity * 255
      }
    }

    tempCtx.putImageData(imageData, 0, 0)
    brushTextureCache.set(cacheKey, tempCanvas)

    return tempCanvas
  }

  const createBrushGradient = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hardness: number,
    color: string,
    opacity: number,
    isErasing: boolean
  ): CanvasGradient => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)

    if (isErasing) {
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
      gradient.addColorStop(hardness, `rgba(255, 255, 255, ${opacity * 0.5})`)
      gradient.addColorStop(1, `rgba(255, 255, 255, 0)`)
    } else {
      const { r, g, b } = parseToRgb(color)
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`)
      gradient.addColorStop(
        hardness,
        `rgba(${r}, ${g}, ${b}, ${opacity * 0.5})`
      )
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    }

    return gradient
  }

  const drawShapeOnContext = (
    ctx: CanvasRenderingContext2D,
    brushType: BrushShape,
    x: number,
    y: number,
    radius: number
  ): void => {
    ctx.beginPath()
    if (brushType === BrushShape.Rect) {
      ctx.rect(x - radius, y - radius, radius * 2, radius * 2)
    } else {
      ctx.arc(x, y, radius, 0, Math.PI * 2, false)
    }
    ctx.fill()
  }

  const drawRgbShape = (
    ctx: CanvasRenderingContext2D,
    point: Point,
    brushType: BrushShape,
    brushRadius: number,
    hardness: number,
    opacity: number
  ): void => {
    const { x, y } = point
    const rgbColor = store.rgbColor

    if (brushType === BrushShape.Rect && hardness < 1) {
      const rgbaColor = formatRgba(rgbColor, opacity)
      const brushTexture = getCachedBrushTexture(
        brushRadius,
        hardness,
        rgbaColor,
        opacity
      )
      ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius)
      return
    }

    if (hardness === 1) {
      const rgbaColor = formatRgba(rgbColor, opacity)
      ctx.fillStyle = rgbaColor
      drawShapeOnContext(ctx, brushType, x, y, brushRadius)
      return
    }

    const gradient = createBrushGradient(
      ctx,
      x,
      y,
      brushRadius,
      hardness,
      rgbColor,
      opacity,
      false
    )
    ctx.fillStyle = gradient
    drawShapeOnContext(ctx, brushType, x, y, brushRadius)
  }

  const drawMaskShape = (
    ctx: CanvasRenderingContext2D,
    point: Point,
    brushType: BrushShape,
    brushRadius: number,
    hardness: number,
    opacity: number,
    isErasing: boolean
  ): void => {
    const { x, y } = point
    const maskColor = store.maskColor

    if (brushType === BrushShape.Rect && hardness < 1) {
      const baseColor = isErasing
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`

      const brushTexture = getCachedBrushTexture(
        brushRadius,
        hardness,
        baseColor,
        opacity
      )
      ctx.drawImage(brushTexture, x - brushRadius, y - brushRadius)
      return
    }

    if (hardness === 1) {
      ctx.fillStyle = isErasing
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
      drawShapeOnContext(ctx, brushType, x, y, brushRadius)
      return
    }

    const maskColorHex = `rgb(${maskColor.r}, ${maskColor.g}, ${maskColor.b})`
    const gradient = createBrushGradient(
      ctx,
      x,
      y,
      brushRadius,
      hardness,
      maskColorHex,
      opacity,
      isErasing
    )
    ctx.fillStyle = gradient
    drawShapeOnContext(ctx, brushType, x, y, brushRadius)
  }

  const drawShape = (point: Point, overrideOpacity?: number) => {
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

    const isErasing = mask_ctx.globalCompositeOperation === 'destination-out'
    const currentTool = store.currentTool
    const isRgbLayer = store.activeLayer === 'rgb'

    if (
      isRgbLayer &&
      currentTool &&
      (currentTool === Tools.Eraser || currentTool === Tools.PaintPen)
    ) {
      drawRgbShape(rgb_ctx, point, brushType, brushRadius, hardness, opacity)
      return
    }

    drawMaskShape(
      mask_ctx,
      point,
      brushType,
      brushRadius,
      hardness,
      opacity,
      isErasing
    )
  }

  const clampSmoothingPrecision = (value: number): number => {
    return Math.min(Math.max(value, 1), 100)
  }

  const generateEquidistantPoints = (
    points: Point[],
    distance: number
  ): Point[] => {
    const result: Point[] = []
    const cumulativeDistances: number[] = [0]

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      const dist = Math.hypot(dx, dy)
      cumulativeDistances[i] = cumulativeDistances[i - 1] + dist
    }

    const totalLength = cumulativeDistances[cumulativeDistances.length - 1]
    const numPoints = Math.floor(totalLength / distance)

    for (let i = 0; i <= numPoints; i++) {
      const targetDistance = i * distance
      let idx = 0

      while (
        idx < cumulativeDistances.length - 1 &&
        cumulativeDistances[idx + 1] < targetDistance
      ) {
        idx++
      }

      if (idx >= points.length - 1) {
        result.push(points[points.length - 1])
        continue
      }

      const d0 = cumulativeDistances[idx]
      const d1 = cumulativeDistances[idx + 1]
      const t = (targetDistance - d0) / (d1 - d0)

      const x = points[idx].x + t * (points[idx + 1].x - points[idx].x)
      const y = points[idx].y + t * (points[idx + 1].y - points[idx].y)

      result.push({ x, y })
    }

    return result
  }

  const drawWithBetterSmoothing = (point: Point): void => {
    if (!smoothingCordsArray.value) {
      smoothingCordsArray.value = []
    }

    const opacityConstant = 1 / (1 + Math.exp(3))
    const interpolatedOpacity =
      1 / (1 + Math.exp(-6 * (store.brushSettings.opacity - 0.5))) -
      opacityConstant

    smoothingCordsArray.value.push(point)

    const POINTS_NR = 5
    if (smoothingCordsArray.value.length < POINTS_NR) {
      return
    }

    let totalLength = 0
    const points = smoothingCordsArray.value
    const len = points.length - 1

    let dx, dy
    for (let i = 0; i < len; i++) {
      dx = points[i + 1].x - points[i].x
      dy = points[i + 1].y - points[i].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    const maxSteps = SMOOTHING_MAX_STEPS
    const minSteps = SMOOTHING_MIN_STEPS

    const smoothing = clampSmoothingPrecision(
      store.brushSettings.smoothingPrecision
    )
    const normalizedSmoothing = (smoothing - 1) / 99

    const stepNr = Math.round(
      Math.round(minSteps + (maxSteps - minSteps) * normalizedSmoothing)
    )

    const distanceBetweenPoints = totalLength / stepNr

    let interpolatedPoints = points

    if (stepNr > 0) {
      interpolatedPoints = generateEquidistantPoints(
        smoothingCordsArray.value,
        distanceBetweenPoints
      )
    }

    if (!initialDraw.value) {
      const spliceIndex = interpolatedPoints.findIndex(
        (p) =>
          p.x === smoothingCordsArray.value[2].x &&
          p.y === smoothingCordsArray.value[2].y
      )

      if (spliceIndex !== -1) {
        interpolatedPoints = interpolatedPoints.slice(spliceIndex + 1)
      }
    }

    for (const p of interpolatedPoints) {
      drawShape(p, interpolatedOpacity)
    }

    if (!initialDraw.value) {
      smoothingCordsArray.value = smoothingCordsArray.value.slice(2)
    } else {
      initialDraw.value = false
    }
  }

  const drawLine = async (
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation
  ): Promise<void> => {
    try {
      const brush_size = store.brushSettings.size
      const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      const steps = Math.ceil(
        distance / ((brush_size / store.brushSettings.smoothingPrecision) * 4)
      )
      const interpolatedOpacity =
        1 / (1 + Math.exp(-6 * (store.brushSettings.opacity - 0.5))) -
        1 / (1 + Math.exp(3))

      initShape(compositionOp)

      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = p1.x + (p2.x - p1.x) * t
        const y = p1.y + (p2.y - p1.y) * t
        const point = { x, y }

        drawShape(point, interpolatedOpacity)
      }
    } catch (error) {
      console.error('[useBrushDrawing] Failed to draw line:', error)
      throw error
    }
  }

  const startDrawing = async (event: PointerEvent): Promise<void> => {
    isDrawing.value = true

    try {
      let compositionOp: CompositionOperation
      const currentTool = store.currentTool
      const coords = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = coordinateTransform.screenToCanvas(coords)

      await createBrushStrokeCanvas()

      if (currentTool === 'eraser' || event.buttons === 2) {
        compositionOp = CompositionOperation.DestinationOut
      } else {
        compositionOp = CompositionOperation.SourceOver
      }

      if (event.shiftKey && lineStartPoint.value) {
        isDrawingLine.value = true
        await drawLine(lineStartPoint.value, coords_canvas, compositionOp)
      } else {
        isDrawingLine.value = false
        initShape(compositionOp)
        drawShape(coords_canvas)
      }

      lineStartPoint.value = coords_canvas
      smoothingCordsArray.value = [coords_canvas]
      smoothingLastDrawTime.value = new Date()
    } catch (error) {
      console.error('[useBrushDrawing] Failed to start drawing:', error)

      isDrawing.value = false
      isDrawingLine.value = false
    }
  }

  const handleDrawing = async (event: PointerEvent): Promise<void> => {
    const diff = performance.now() - smoothingLastDrawTime.value.getTime()
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)
    const currentTool = store.currentTool

    if (diff > 20 && !isDrawing.value) {
      requestAnimationFrame(() => {
        try {
          initShape(CompositionOperation.SourceOver)
          drawShape(coords_canvas)
          smoothingCordsArray.value.push(coords_canvas)
        } catch (error) {
          console.error('[useBrushDrawing] Drawing error:', error)
        }
      })
    } else {
      requestAnimationFrame(() => {
        try {
          if (currentTool === 'eraser' || event.buttons === 2) {
            initShape(CompositionOperation.DestinationOut)
          } else {
            initShape(CompositionOperation.SourceOver)
          }

          drawWithBetterSmoothing(coords_canvas)
        } catch (error) {
          console.error('[useBrushDrawing] Drawing error:', error)
        }
      })
    }

    smoothingLastDrawTime.value = new Date()
  }

  const drawEnd = async (event: PointerEvent): Promise<void> => {
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    if (isDrawing.value) {
      isDrawing.value = false
      store.canvasHistory.saveState()
      lineStartPoint.value = coords_canvas
      initialDraw.value = true
    }
  }

  const startBrushAdjustment = async (event: PointerEvent): Promise<void> => {
    event.preventDefault()

    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    store.brushPreviewGradientVisible = true
    initialPoint.value = coords_canvas
  }

  const handleBrushAdjustment = async (event: PointerEvent): Promise<void> => {
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
        100,
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

  const saveBrushSettings = (): void => {
    saveBrushToCache('maskeditor_brush_settings', store.brushSettings)
  }

  return {
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment,
    handleBrushAdjustment,
    saveBrushSettings
  }
}
