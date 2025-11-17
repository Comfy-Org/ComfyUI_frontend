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

// Phase 1 GPU stroke resources
let quadVertexBuffer: GPUBuffer | null = null
let quadIndexBuffer: GPUBuffer | null = null
let strokePosBuffer: GPUBuffer | null = null
let uniformBuffer: GPUBuffer | null = null
let strokeBindGroup: GPUBindGroup | null = null
let strokePipeline: GPURenderPipeline | null = null

// GPU Resources (scope fix)
let maskTexture: GPUTexture | null = null
let rgbTexture: GPUTexture | null = null
let device: GPUDevice | null = null

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

      // Phase 1: Initialize stroke render pipeline
      console.warn('🎨 Phase 1: Initializing stroke pipeline & clamp...')

      // canvasWidth/Height from earlier
      device = store.tgpuRoot!.device!

      // Quad verts (NDC)
      const quadVerts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1])
      quadVertexBuffer = device!.createBuffer({
        label: 'quad verts',
        size: quadVerts.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
      })
      new Float32Array(quadVertexBuffer!.getMappedRange()).set(quadVerts)
      quadVertexBuffer!.unmap()

      // Quad indices
      const quadIdxs = new Uint16Array([0, 1, 2, 0, 2, 3])
      quadIndexBuffer = device!.createBuffer({
        label: 'quad idx',
        size: quadIdxs.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true
      })
      new Uint16Array(quadIndexBuffer!.getMappedRange()).set(quadIdxs)
      quadIndexBuffer!.unmap()

      // Stroke pos buffer (instance data)
      strokePosBuffer = device!.createBuffer({
        label: 'stroke pos',
        size: 4096 * 8,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      })

      // Stroke uniform (size, opacity, hardness, pad, r,g,b,pad)
      uniformBuffer = device!.createBuffer({
        label: 'stroke uniform',
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      })

      // Bind group layout
      const strokeBgl = device!.createBindGroupLayout({
        label: 'stroke bgl',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
          }
        ]
      })

      // Stroke shader WGSL
      const strokeWgsl = `
      struct Uniforms {
        size: f32,
        opacity: f32,
        hardness: f32,
        pad: f32,
        r: f32,
        g: f32,
        b: f32,
        pad2: f32,
      }
      @group(0) @binding(0) var<uniform> u: Uniforms;

      struct VOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) offset: vec2<f32>,
      }

      @vertex
      fn vs(@location(0) q: vec2<f32>, @location(1) p: vec2<f32>) -> VOut {
        let off = q * u.size;
        return VOut(vec4(p + off, 0,1), q);
      }

      @fragment
      fn fs(v: VOut) -> @location(0) vec4<f32> {
        let d = length(v.offset) * 0.5;
        let hr = u.hardness * 0.5;
        let fr = 0.5 - hr;
        var a = 0.0;
        if (d <= hr) {
          a = u.opacity;
        } else if (d <= 0.5) {
          a = u.opacity * (1.0 - (d - hr) / fr);
        } else {
          discard;
        }
        return vec4(u.r, u.g, u.b, a);
      }
      `
      const strokeShader = device!.createShaderModule({ code: strokeWgsl })

      // Stroke pipeline
      strokePipeline = device!.createRenderPipeline({
        label: 'stroke splat',
        layout: device!.createPipelineLayout({ bindGroupLayouts: [strokeBgl] }),
        vertex: {
          module: strokeShader,
          entryPoint: 'vs',
          buffers: [
            {
              arrayStride: 8,
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' }
              ]
            },
            {
              arrayStride: 8,
              stepMode: 'instance',
              attributes: [
                { shaderLocation: 1, offset: 0, format: 'float32x2' }
              ]
            }
          ]
        },
        fragment: {
          module: strokeShader,
          entryPoint: 'fs',
          targets: [
            {
              format: 'rgba8unorm',
              blend: {
                color: {
                  operation: 'add',
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha'
                },
                alpha: {
                  operation: 'add',
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha'
                }
              }
            }
          ]
        },
        primitive: { topology: 'triangle-list' }
      })

      // Stroke bind group
      strokeBindGroup = device!.createBindGroup({
        layout: strokeBgl,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer! } }]
      })

      console.warn('✅ Phase 1 complete: stroke pipeline ready')
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

    // Pure canvas rendering
    for (const p of interpolatedPoints) {
      drawShape(p, interpolatedOpacity)
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

  // Add drawStrokeGPU function before the return statement
  const drawStrokeGPU = (points: Point[]) => {
    if (!strokePipeline || points.length === 0 || !device) {
      console.warn('Phase 1 GPU not ready')
      return
    }

    const canvasWidth = store.maskCanvas!.width
    const canvasHeight = store.maskCanvas!.height

    const numPoints = points.length
    const testSize = 300 // px (larger for visibility)
    const testOpacity = 1.0
    const testHardness = 0.8

    // Upload stroke positions (normalized to NDC)
    const posData = new Float32Array(numPoints * 2)
    for (let i = 0; i < numPoints; i++) {
      posData[i * 2 + 0] = (2 * points[i].x) / canvasWidth - 1
      posData[i * 2 + 1] = 1 - (2 * points[i].y) / canvasHeight
    }
    device!.queue.writeBuffer(strokePosBuffer!, 0, posData)

    // Upload stroke uniform (size normalized to NDC)
    const ndcSize = (2 * testSize) / canvasWidth
    //const hardness = testHardness
    let r = 1.0,
      g = 0.0,
      b = 0.0 // Red for visibility
    if (store.activeLayer === 'rgb') {
      const rgb = parseToRgb(store.rgbColor)
      r = rgb.r / 255
      g = rgb.g / 255
      b = rgb.b / 255
    }
    const uData = new Float32Array([
      ndcSize,
      testOpacity,
      testHardness,
      0,
      r,
      g,
      b,
      0
    ])
    device!.queue.writeBuffer(uniformBuffer!, 0, uData)

    console.warn('uData:', uData)

    // Command encoder
    const encoder = device!.createCommandEncoder({
      label: 'phase1 stroke direct'
    })

    // Render stroke directly to target layer (DEBUG: clear green first)
    const targetTexture =
      store.activeLayer === 'rgb' ? rgbTexture! : maskTexture!
    const strokePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.2, g: 0.8, b: 0.2, a: 1.0 } // Green bg
        }
      ]
    })
    strokePass.setPipeline(strokePipeline!)
    strokePass.setBindGroup(0, strokeBindGroup!)
    strokePass.setIndexBuffer(quadIndexBuffer!, 'uint16')
    strokePass.setVertexBuffer(0, quadVertexBuffer!)
    strokePass.setVertexBuffer(1, strokePosBuffer!)
    strokePass.drawIndexed(6, numPoints)
    strokePass.end()

    device!.queue.submit([encoder.finish()])

    console.warn(
      `🎨 Phase 1 stroke: ${numPoints} points rendered directly to ${store.activeLayer} layer`
    )
  }

  // Function to inspect GPU texture by copying back to canvas
  const inspectTexture = async () => {
    if (
      !device ||
      !maskTexture ||
      !rgbTexture ||
      !store.maskCanvas ||
      !store.rgbCanvas
    ) {
      console.warn('GPU resources not ready for inspection')
      return
    }

    const targetTexture = store.activeLayer === 'rgb' ? rgbTexture : maskTexture
    const canvasWidth = store.maskCanvas.width
    const canvasHeight = store.maskCanvas.height

    // Create staging buffer for readback
    const buffer = device.createBuffer({
      size: canvasWidth * canvasHeight * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    // Copy texture to buffer
    const encoder = device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: targetTexture },
      { buffer, bytesPerRow: canvasWidth * 4 },
      { width: canvasWidth, height: canvasHeight }
    )
    device.queue.submit([encoder.finish()])

    // Map and copy to canvas
    await buffer.mapAsync(GPUMapMode.READ)
    const data = new Uint8Array(buffer.getMappedRange())
    const imageData = new ImageData(
      new Uint8ClampedArray(data),
      canvasWidth,
      canvasHeight
    )

    // Log sample pixels: stroke start/center/end
    const samples = [
      { x: 100, y: 100 },
      { x: 125, y: 125 },
      { x: 150, y: 150 },
      { x: 200, y: 200 }
    ]
    for (const s of samples) {
      const sx = Math.floor(s.x),
        sy = Math.floor(s.y)
      const idx = (sy * canvasWidth + sx) * 4
      console.warn(
        `Pixel (${sx},${sy}): R=${data[idx] / 255},G=${data[idx + 1] / 255},B=${data[idx + 2] / 255},A=${data[idx + 3] / 255}`
      )
    }

    const ctx = store.activeLayer === 'rgb' ? store.rgbCtx : store.maskCtx
    if (ctx) {
      ctx.putImageData(imageData, 0, 0)
      console.warn(
        `✅ Texture inspected: copied ${store.activeLayer} layer to canvas`
      )
    }

    buffer.unmap()
  }

  // Expose for testing in development
  if (typeof window !== 'undefined') {
    ;(window as any).drawStrokeGPU = drawStrokeGPU
    ;(window as any).inspectTexture = inspectTexture
  }

  const destroy = (): void => {
    // Clean up GPU textures
    if (maskTexture) {
      maskTexture.destroy()
      maskTexture = null
    }
    if (rgbTexture) {
      rgbTexture.destroy()
      rgbTexture = null
    }

    if (store.tgpuRoot) {
      console.warn('Destroying TypeGPU root:', store.tgpuRoot)
      store.tgpuRoot.destroy()
      store.tgpuRoot = null
      device = null
    }

    // Cleanup Phase 1 resources
    if (quadVertexBuffer) quadVertexBuffer.destroy()
    if (quadIndexBuffer) quadIndexBuffer.destroy()
    if (strokePosBuffer) strokePosBuffer.destroy()
    if (uniformBuffer) uniformBuffer.destroy()

    // bindgroups/pipelines auto released
  }

  return {
    startDrawing,
    handleDrawing,
    drawEnd,
    startBrushAdjustment,
    handleBrushAdjustment,
    saveBrushSettings,
    destroy,
    drawStrokeGPU,
    initGPUResources
  }
}
