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
import TGPU from 'typegpu'
import { GPUBrushRenderer } from './gpu/GPUBrushRenderer'

// GPU Resources (scope fix)
let maskTexture: GPUTexture | null = null
let rgbTexture: GPUTexture | null = null
let device: GPUDevice | null = null
let renderer: GPUBrushRenderer | null = null

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

  const getCachedBrushTexture = (
    radius: number,
    hardness: number,
    color: string,
    opacity: number
  ): HTMLCanvasElement => {
    const cacheKey = `${radius}_${hardness}_${color}_${opacity}`

    // Create new cache for textures since old one removed
    const brushTextureCache = new QuickLRU<string, HTMLCanvasElement>({
      maxSize: 8
    })

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

  const SMOOTHING_MAX_STEPS = 30
  const SMOOTHING_MIN_STEPS = 2

  const isDrawing = ref(false)
  const isDrawingLine = ref(false)
  const lineStartPoint = ref<Point | null>(null)
  const smoothingCordsArray = ref<Point[]>([])
  const smoothingLastDrawTime = ref(new Date())
  const initialDraw = ref(true)

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

  // GPU Resources
  const initTypeGPU = async (): Promise<void> => {
    if (store.tgpuRoot) return

    try {
      const root = await TGPU.init()
      store.tgpuRoot = root
      device = root.device
      console.warn('✅ TypeGPU initialized! Root:', root)
      console.warn('Device info:', root.device.limits)
    } catch (error) {
      console.error('Failed to initialize TypeGPU:', error)
    }
  }

  const initGPUResources = async (): Promise<void> => {
    // Ensure TypeGPU is initialized first
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

      // Create read/write textures (RGBA8Unorm, copy from canvas)
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

      // Upload initial canvas data to GPU
      const maskImageData = store.maskCtx.getImageData(
        0,
        0,
        canvasWidth,
        canvasHeight
      )
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
      device.queue.writeTexture(
        { texture: rgbTexture },
        rgbImageData.data,
        { bytesPerRow: canvasWidth * 4 },
        { width: canvasWidth, height: canvasHeight }
      )

      console.warn('✅ GPU resources initialized successfully')

      renderer = new GPUBrushRenderer(device!)
      console.warn('✅ Brush renderer initialized')
    } catch (error) {
      console.error('Failed to initialize GPU resources:', error)
      // Reset to null on failure
      maskTexture = null
      rgbTexture = null
    }
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

  const formatRgba = (hex: string, alpha: number): string => {
    const { r, g, b } = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

  const drawWithBetterSmoothing = async (point: Point): Promise<void> => {
    smoothingCordsArray.value.push(point)

    const POINTS_NR = 5
    if (smoothingCordsArray.value.length < POINTS_NR) return

    let totalLength = 0
    const points = smoothingCordsArray.value
    const len = points.length - 1
    for (let i = 0; i < len; i++) {
      const dx = points[i + 1].x - points[i].x
      const dy = points[i + 1].y - points[i].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    const smoothing = clampSmoothingPrecision(
      store.brushSettings.smoothingPrecision
    )
    const normalizedSmoothing = (smoothing - 1) / 99
    const stepNr = Math.round(
      SMOOTHING_MIN_STEPS +
        (SMOOTHING_MAX_STEPS - SMOOTHING_MIN_STEPS) * normalizedSmoothing
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

    // GPU render
    if (renderer) {
      const isErasing =
        store.maskCtx!.globalCompositeOperation === 'destination-out'
      if (isErasing) {
        // Fallback CPU for erase
        for (const p of interpolatedPoints) {
          drawShape(p, 1)
        }
      } else {
        const width = store.maskCanvas!.width
        const height = store.maskCanvas!.height
        const targetTexture = maskTexture!
        const targetView = targetTexture.createView()
        const colorStr = '#ffffff'
        const { r, g, b } = parseToRgb(colorStr)
        const strokePoints = interpolatedPoints.map((p) => ({
          x: p.x,
          y: p.y,
          pressure: 1
        }))
        renderer!.renderStroke(targetView, strokePoints, {
          size: store.brushSettings.size,
          opacity: store.brushSettings.opacity,
          hardness: store.brushSettings.hardness,
          color: [r / 255, g / 255, b / 255],
          width,
          height
        })
      }
    } else {
      // Fallback CPU
      for (const p of interpolatedPoints) {
        drawShape(p, 1)
      }
    }

    if (!initialDraw.value) {
      smoothingCordsArray.value = smoothingCordsArray.value.slice(2)
    } else {
      initialDraw.value = false
    }
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

  const drawLine = async (
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation
  ): Promise<void> => {
    const brush_size = store.brushSettings.size
    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const steps = Math.ceil(
      distance / ((brush_size / store.brushSettings.smoothingPrecision) * 4)
    )
    const interpolatedOpacity =
      1 / (1 + Math.exp(-6 * (store.brushSettings.opacity - 0.5))) -
      1 / (1 + Math.exp(3))

    const points: Point[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      points.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t })
    }

    if (renderer && compositionOp === CompositionOperation.SourceOver) {
      const width = store.maskCanvas!.width
      const height = store.maskCanvas!.height
      const targetTexture = maskTexture!
      const targetView = targetTexture.createView()
      const colorStr = '#ffffff'
      const { r, g, b } = parseToRgb(colorStr)
      const strokePoints = points.map((p) => ({ x: p.x, y: p.y, pressure: 1 }))
      renderer!.renderStroke(targetView, strokePoints, {
        size: store.brushSettings.size,
        opacity: store.brushSettings.opacity,
        hardness: store.brushSettings.hardness,
        color: [r / 255, g / 255, b / 255],
        width,
        height
      })
    } else {
      // CPU fallback
      initShape(compositionOp)
      for (const point of points) {
        drawShape(point, interpolatedOpacity)
      }
    }
  }

  const startDrawing = async (event: PointerEvent): Promise<void> => {
    isDrawing.value = true

    try {
      let compositionOp: CompositionOperation
      const currentTool = store.currentTool
      const coords = { x: event.offsetX, y: event.offsetY }
      const coords_canvas = coordinateTransform.screenToCanvas(coords)

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
        await gpuDrawPoint(coords_canvas)
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
      requestAnimationFrame(async () => {
        try {
          initShape(CompositionOperation.SourceOver)
          await gpuDrawPoint(coords_canvas)
          smoothingCordsArray.value.push(coords_canvas)
        } catch (error) {
          console.error('[useBrushDrawing] Drawing error:', error)
        }
      })
    } else {
      requestAnimationFrame(async () => {
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

  const drawEnd = async (event: PointerEvent): Promise<void> => {
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = coordinateTransform.screenToCanvas(coords)

    if (isDrawing.value) {
      isDrawing.value = false

      store.canvasHistory.saveState()
      lineStartPoint.value = coords_canvas
      initialDraw.value = true
      await copyGpuToCanvas()
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

  const copyGpuToCanvas = async (): Promise<void> => {
    if (
      !device ||
      !maskTexture ||
      !rgbTexture ||
      !store.maskCanvas ||
      !store.rgbCanvas ||
      !store.maskCtx ||
      !store.rgbCtx
    )
      return

    const width = store.maskCanvas.width
    const height = store.maskCanvas.height

    const bufferSize = width * height * 4
    const maskBuffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    const rgbBuffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    const encoder = device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: maskTexture },
      { buffer: maskBuffer, bytesPerRow: width * 4 },
      { width, height }
    )
    encoder.copyTextureToBuffer(
      { texture: rgbTexture },
      { buffer: rgbBuffer, bytesPerRow: width * 4 },
      { width, height }
    )
    device.queue.submit([encoder.finish()])

    await Promise.all([
      maskBuffer.mapAsync(GPUMapMode.READ),
      rgbBuffer.mapAsync(GPUMapMode.READ)
    ])

    const maskData = new Uint8ClampedArray(maskBuffer.getMappedRange())
    store.maskCtx.putImageData(new ImageData(maskData, width, height), 0, 0)

    const rgbData = new Uint8ClampedArray(rgbBuffer.getMappedRange())
    store.rgbCtx.putImageData(new ImageData(rgbData, width, height), 0, 0)

    maskBuffer.unmap()
    rgbBuffer.unmap()
    maskBuffer.destroy()
    rgbBuffer.destroy()
  }

  const destroy = (): void => {
    renderer?.destroy()
    if (maskTexture) {
      maskTexture.destroy()
      maskTexture = null
    }
    if (rgbTexture) {
      rgbTexture.destroy()
      rgbTexture = null
    }
    if (store.tgpuRoot) {
      store.tgpuRoot.destroy()
      store.tgpuRoot = null
    }
    device = null
  }

  const gpuDrawPoint = async (point: Point, opacity: number = 1) => {
    if (renderer) {
      const width = store.maskCanvas!.width
      const height = store.maskCanvas!.height
      const targetView = maskTexture!.createView()
      const strokePoints = [{ x: point.x, y: point.y, pressure: opacity }]
      renderer!.renderStroke(targetView, strokePoints, {
        size: store.brushSettings.size,
        opacity: store.brushSettings.opacity,
        hardness: store.brushSettings.hardness,
        color: [1, 1, 1], // white for mask
        width,
        height
      })
    } else {
      drawShape(point, opacity)
    }
  }

  return {
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment,
    handleBrushAdjustment,
    saveBrushSettings,
    destroy,
    initGPUResources
  }
}
