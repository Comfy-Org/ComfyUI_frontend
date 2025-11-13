import QuickLRU from '@alloc/quick-lru'
import { hexToRgb, parseToRgb } from '@/utils/colorUtil'
import { app } from '@/scripts/app'
import {
  BrushShape,
  CompositionOperation,
  MaskBlendMode,
  Tools,
  type Brush,
  type ImageLayer,
  type Point
} from '../types'
import { loadBrushFromCache, saveBrushToCache } from '../utils/brushCache'

// Forward declaration for MessageBroker type
interface MessageBroker {
  subscribe(topic: string, callback: (data?: any) => void): void
  publish(topic: string, data?: any): void
  pull<T>(topic: string, data?: any): Promise<T>
  createPullTopic(topic: string, callback: (data?: any) => Promise<any>): void
}

// Forward declaration for MaskEditorDialog type
interface MaskEditorDialog {
  getMessageBroker(): MessageBroker
}

class BrushTool {
  brushSettings: Brush //this saves the current brush settings
  maskBlendMode: MaskBlendMode

  isDrawing: boolean = false
  isDrawingLine: boolean = false
  lineStartPoint: Point | null = null
  smoothingPrecision: number = 10
  smoothingCordsArray: Point[] = []
  smoothingLastDrawTime!: Date
  maskCtx: CanvasRenderingContext2D | null = null
  rgbCtx: CanvasRenderingContext2D | null = null
  initialDraw: boolean = true

  private static brushTextureCache = new QuickLRU<string, HTMLCanvasElement>({
    maxSize: 8 // Reasonable limit for brush texture variations?
  })

  brushStrokeCanvas: HTMLCanvasElement | null = null
  brushStrokeCtx: CanvasRenderingContext2D | null = null

  private static readonly SMOOTHING_MAX_STEPS = 30
  private static readonly SMOOTHING_MIN_STEPS = 2

  //brush adjustment
  isBrushAdjusting: boolean = false
  brushPreviewGradient: HTMLElement | null = null
  initialPoint: Point | null = null
  useDominantAxis: boolean = false
  brushAdjustmentSpeed: number = 1.0

  maskEditor: MaskEditorDialog
  messageBroker: MessageBroker

  private rgbColor: string = '#FF0000' // Default color
  private activeLayer: ImageLayer = 'mask'

  constructor(maskEditor: MaskEditorDialog) {
    this.maskEditor = maskEditor
    this.messageBroker = maskEditor.getMessageBroker()
    this.createListeners()
    this.addPullTopics()

    this.useDominantAxis = app.extensionManager.setting.get(
      'Comfy.MaskEditor.UseDominantAxis'
    )
    this.brushAdjustmentSpeed = app.extensionManager.setting.get(
      'Comfy.MaskEditor.BrushAdjustmentSpeed'
    )

    const cachedBrushSettings = loadBrushFromCache('maskeditor_brush_settings')
    if (cachedBrushSettings) {
      this.brushSettings = cachedBrushSettings
    } else {
      this.brushSettings = {
        type: BrushShape.Arc,
        size: 10,
        opacity: 0.7,
        hardness: 1,
        smoothingPrecision: 10
      }
    }

    this.maskBlendMode = MaskBlendMode.Black
  }

  private createListeners() {
    //setters
    this.messageBroker.subscribe('setBrushSize', (size: number) =>
      this.setBrushSize(size)
    )
    this.messageBroker.subscribe('setBrushOpacity', (opacity: number) =>
      this.setBrushOpacity(opacity)
    )
    this.messageBroker.subscribe('setBrushHardness', (hardness: number) =>
      this.setBrushHardness(hardness)
    )
    this.messageBroker.subscribe('setBrushShape', (type: BrushShape) =>
      this.setBrushType(type)
    )
    this.messageBroker.subscribe(
      'setActiveLayer',
      (layer: ImageLayer) => (this.activeLayer = layer)
    )
    this.messageBroker.subscribe(
      'setBrushSmoothingPrecision',
      (precision: number) => this.setBrushSmoothingPrecision(precision)
    )
    this.messageBroker.subscribe('setRGBColor', (color: string) => {
      this.rgbColor = color
    })
    //brush adjustment
    this.messageBroker.subscribe(
      'brushAdjustmentStart',
      (event: PointerEvent) => this.startBrushAdjustment(event)
    )
    this.messageBroker.subscribe('brushAdjustment', (event: PointerEvent) =>
      this.handleBrushAdjustment(event)
    )
    //drawing
    this.messageBroker.subscribe('drawStart', (event: PointerEvent) =>
      this.startDrawing(event)
    )
    this.messageBroker.subscribe('draw', (event: PointerEvent) =>
      this.handleDrawing(event)
    )
    this.messageBroker.subscribe('drawEnd', (event: PointerEvent) =>
      this.drawEnd(event)
    )
  }

  private addPullTopics() {
    this.messageBroker.createPullTopic(
      'brushSize',
      async () => this.brushSettings.size
    )
    this.messageBroker.createPullTopic(
      'brushOpacity',
      async () => this.brushSettings.opacity
    )
    this.messageBroker.createPullTopic(
      'brushHardness',
      async () => this.brushSettings.hardness
    )
    this.messageBroker.createPullTopic(
      'brushType',
      async () => this.brushSettings.type
    )
    this.messageBroker.createPullTopic(
      'brushSmoothingPrecision',
      async () => this.brushSettings.smoothingPrecision
    )
    this.messageBroker.createPullTopic(
      'maskBlendMode',
      async () => this.maskBlendMode
    )
    this.messageBroker.createPullTopic(
      'brushSettings',
      async () => this.brushSettings
    )
  }

  private async createBrushStrokeCanvas() {
    if (this.brushStrokeCanvas !== null) {
      return
    }

    const maskCanvas =
      await this.messageBroker.pull<HTMLCanvasElement>('maskCanvas')
    const canvas = document.createElement('canvas')
    canvas.width = maskCanvas.width
    canvas.height = maskCanvas.height

    this.brushStrokeCanvas = canvas
    this.brushStrokeCtx = canvas.getContext('2d')!
  }

  private async startDrawing(event: PointerEvent) {
    this.isDrawing = true
    let compositionOp: CompositionOperation
    let currentTool = await this.messageBroker.pull('currentTool')
    let coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull<Point>(
      'screenToCanvas',
      coords
    )
    await this.createBrushStrokeCanvas()

    //set drawing mode
    if (currentTool === Tools.Eraser || event.buttons == 2) {
      compositionOp = CompositionOperation.DestinationOut //eraser
    } else {
      compositionOp = CompositionOperation.SourceOver //pen
    }

    if (event.shiftKey && this.lineStartPoint) {
      this.isDrawingLine = true
      this.drawLine(this.lineStartPoint, coords_canvas, compositionOp)
    } else {
      this.isDrawingLine = false
      this.init_shape(compositionOp)
      this.draw_shape(coords_canvas)
    }
    this.lineStartPoint = coords_canvas
    this.smoothingCordsArray = [coords_canvas] //used to smooth the drawing line
    this.smoothingLastDrawTime = new Date()
  }

  private async handleDrawing(event: PointerEvent) {
    var diff = performance.now() - this.smoothingLastDrawTime.getTime()
    let coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull<Point>(
      'screenToCanvas',
      coords
    )
    let currentTool = await this.messageBroker.pull('currentTool')

    if (diff > 20 && !this.isDrawing)
      requestAnimationFrame(() => {
        this.init_shape(CompositionOperation.SourceOver)
        this.draw_shape(coords_canvas)
        this.smoothingCordsArray.push(coords_canvas)
      })
    else
      requestAnimationFrame(() => {
        if (currentTool === Tools.Eraser || event.buttons == 2) {
          this.init_shape(CompositionOperation.DestinationOut)
        } else {
          this.init_shape(CompositionOperation.SourceOver)
        }

        //use drawWithSmoothing for better performance or change step in drawWithBetterSmoothing
        this.drawWithBetterSmoothing(coords_canvas)
      })

    this.smoothingLastDrawTime = new Date()
  }

  private async drawEnd(event: PointerEvent) {
    const coords = { x: event.offsetX, y: event.offsetY }
    const coords_canvas = await this.messageBroker.pull<Point>(
      'screenToCanvas',
      coords
    )

    if (this.isDrawing) {
      this.isDrawing = false
      this.messageBroker.publish('saveState')
      this.lineStartPoint = coords_canvas
      this.initialDraw = true
    }
  }

  private clampSmoothingPrecision(value: number): number {
    return Math.min(Math.max(value, 1), 100)
  }

  private drawWithBetterSmoothing(point: Point) {
    // Add current point to the smoothing array
    if (!this.smoothingCordsArray) {
      this.smoothingCordsArray = []
    }
    const opacityConstant = 1 / (1 + Math.exp(3))
    const interpolatedOpacity =
      1 / (1 + Math.exp(-6 * (this.brushSettings.opacity - 0.5))) -
      opacityConstant

    this.smoothingCordsArray.push(point)

    // Keep a moving window of points for the spline
    const POINTS_NR = 5
    if (this.smoothingCordsArray.length < POINTS_NR) {
      return
    }

    // Calculate total length more efficiently
    let totalLength = 0
    const points = this.smoothingCordsArray
    const len = points.length - 1

    // Use local variables for better performance
    let dx, dy
    for (let i = 0; i < len; i++) {
      dx = points[i + 1].x - points[i].x
      dy = points[i + 1].y - points[i].y
      totalLength += Math.sqrt(dx * dx + dy * dy)
    }

    const maxSteps = BrushTool.SMOOTHING_MAX_STEPS
    const minSteps = BrushTool.SMOOTHING_MIN_STEPS

    const smoothing = this.clampSmoothingPrecision(
      this.brushSettings.smoothingPrecision
    )
    const normalizedSmoothing = (smoothing - 1) / 99 // Convert to 0-1 range

    // Optionality to use exponential curve
    const stepNr = Math.round(
      Math.round(minSteps + (maxSteps - minSteps) * normalizedSmoothing)
    )

    // Calculate step distance capped by brush size
    const distanceBetweenPoints = totalLength / stepNr

    let interpolatedPoints = points

    if (stepNr > 0) {
      //this calculation needs to be improved
      interpolatedPoints = this.generateEquidistantPoints(
        this.smoothingCordsArray,
        distanceBetweenPoints // Distance between interpolated points
      )
    }

    if (!this.initialDraw) {
      // Remove the first 3 points from the array to avoid drawing the same points twice
      const spliceIndex = interpolatedPoints.findIndex(
        (point) =>
          point.x === this.smoothingCordsArray[2].x &&
          point.y === this.smoothingCordsArray[2].y
      )

      if (spliceIndex !== -1) {
        interpolatedPoints = interpolatedPoints.slice(spliceIndex + 1)
      }
    }

    // Draw all interpolated points
    for (const point of interpolatedPoints) {
      this.draw_shape(point, interpolatedOpacity)
    }

    if (!this.initialDraw) {
      // initially draw on all 5 points, then remove the first 3 points to go into 2 new, 3 old points cycle
      this.smoothingCordsArray = this.smoothingCordsArray.slice(2)
    } else {
      this.initialDraw = false
    }
  }

  private async drawLine(
    p1: Point,
    p2: Point,
    compositionOp: CompositionOperation
  ) {
    const brush_size = await this.messageBroker.pull<number>('brushSize')
    const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    const steps = Math.ceil(
      distance / ((brush_size / this.brushSettings.smoothingPrecision) * 4)
    ) // Adjust for smoother lines
    const interpolatedOpacity =
      1 / (1 + Math.exp(-6 * (this.brushSettings.opacity - 0.5))) -
      1 / (1 + Math.exp(3))
    this.init_shape(compositionOp)

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = p1.x + (p2.x - p1.x) * t
      const y = p1.y + (p2.y - p1.y) * t
      const point = { x: x, y: y }
      this.draw_shape(point, interpolatedOpacity)
    }
  }

  //brush adjustment

  private async startBrushAdjustment(event: PointerEvent) {
    event.preventDefault()
    const coords = { x: event.offsetX, y: event.offsetY }
    let coords_canvas = await this.messageBroker.pull<Point>(
      'screenToCanvas',
      coords
    )
    this.messageBroker.publish('setBrushPreviewGradientVisibility', true)
    this.initialPoint = coords_canvas
    this.isBrushAdjusting = true
    return
  }

  private async handleBrushAdjustment(event: PointerEvent) {
    const coords = { x: event.offsetX, y: event.offsetY }
    const brushDeadZone = 5
    let coords_canvas = await this.messageBroker.pull<Point>(
      'screenToCanvas',
      coords
    )

    const delta_x = coords_canvas.x - this.initialPoint!.x
    const delta_y = coords_canvas.y - this.initialPoint!.y

    const effectiveDeltaX = Math.abs(delta_x) < brushDeadZone ? 0 : delta_x
    const effectiveDeltaY = Math.abs(delta_y) < brushDeadZone ? 0 : delta_y

    // New dominant axis logic
    let finalDeltaX = effectiveDeltaX
    let finalDeltaY = effectiveDeltaY

    console.log(this.useDominantAxis)

    if (this.useDominantAxis) {
      // New setting flag
      const ratio = Math.abs(effectiveDeltaX) / Math.abs(effectiveDeltaY)
      const threshold = 2.0 // Configurable threshold

      if (ratio > threshold) {
        finalDeltaY = 0 // X is dominant
      } else if (ratio < 1 / threshold) {
        finalDeltaX = 0 // Y is dominant
      }
    }

    const cappedDeltaX = Math.max(-100, Math.min(100, finalDeltaX))
    const cappedDeltaY = Math.max(-100, Math.min(100, finalDeltaY))

    // Rest of the function remains the same
    const newSize = Math.max(
      1,
      Math.min(
        100,
        this.brushSettings.size! +
          (cappedDeltaX / 35) * this.brushAdjustmentSpeed
      )
    )

    const newHardness = Math.max(
      0,
      Math.min(
        1,
        this.brushSettings!.hardness -
          (cappedDeltaY / 4000) * this.brushAdjustmentSpeed
      )
    )

    this.brushSettings.size = newSize
    this.brushSettings.hardness = newHardness

    this.messageBroker.publish('updateBrushPreview')
  }

  //helper functions

  private async draw_shape(point: Point, overrideOpacity?: number) {
    const brushSettings: Brush = this.brushSettings
    const maskCtx =
      this.maskCtx ||
      (await this.messageBroker.pull<CanvasRenderingContext2D>('maskCtx'))
    const rgbCtx =
      this.rgbCtx ||
      (await this.messageBroker.pull<CanvasRenderingContext2D>('rgbCtx'))
    const brushType = await this.messageBroker.pull('brushType')
    const maskColor = await this.messageBroker.pull<{
      r: number
      g: number
      b: number
    }>('getMaskColor')
    const size = brushSettings.size
    const brushSettingsSliderOpacity = brushSettings.opacity
    const opacity =
      overrideOpacity == undefined
        ? brushSettingsSliderOpacity
        : overrideOpacity
    const hardness = brushSettings.hardness
    const x = point.x
    const y = point.y

    const brushRadius = size
    const isErasing = maskCtx.globalCompositeOperation === 'destination-out'
    const currentTool = await this.messageBroker.pull('currentTool')

    // Helper function to get or create cached brush texture
    const getCachedBrushTexture = (
      radius: number,
      hardness: number,
      color: string,
      opacity: number
    ): HTMLCanvasElement => {
      const cacheKey = `${radius}_${hardness}_${color}_${opacity}`

      if (BrushTool.brushTextureCache.has(cacheKey)) {
        return BrushTool.brushTextureCache.get(cacheKey)!
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

      // Pre-calculate values to avoid repeated computations
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

      // Cache the texture
      BrushTool.brushTextureCache.set(cacheKey, tempCanvas)

      return tempCanvas
    }

    // RGB brush logic
    if (
      this.activeLayer === 'rgb' &&
      (currentTool === Tools.Eraser || currentTool === Tools.PaintPen)
    ) {
      const rgbaColor = this.formatRgba(this.rgbColor, opacity)

      if (brushType === BrushShape.Rect && hardness < 1) {
        const brushTexture = getCachedBrushTexture(
          brushRadius,
          hardness,
          rgbaColor,
          opacity
        )
        rgbCtx.drawImage(brushTexture, x - brushRadius, y - brushRadius)
        return
      }

      // For max hardness, use solid fill to avoid anti-aliasing
      if (hardness === 1) {
        rgbCtx.fillStyle = rgbaColor
        rgbCtx.beginPath()
        if (brushType === BrushShape.Rect) {
          rgbCtx.rect(
            x - brushRadius,
            y - brushRadius,
            brushRadius * 2,
            brushRadius * 2
          )
        } else {
          rgbCtx.arc(x, y, brushRadius, 0, Math.PI * 2, false)
        }
        rgbCtx.fill()
        return
      }

      // For soft brushes, use gradient
      let gradient = rgbCtx.createRadialGradient(x, y, 0, x, y, brushRadius)
      gradient.addColorStop(0, rgbaColor)
      gradient.addColorStop(
        hardness,
        this.formatRgba(this.rgbColor, opacity * 0.5)
      )
      gradient.addColorStop(1, this.formatRgba(this.rgbColor, 0))

      rgbCtx.fillStyle = gradient
      rgbCtx.beginPath()
      if (brushType === BrushShape.Rect) {
        rgbCtx.rect(
          x - brushRadius,
          y - brushRadius,
          brushRadius * 2,
          brushRadius * 2
        )
      } else {
        rgbCtx.arc(x, y, brushRadius, 0, Math.PI * 2, false)
      }
      rgbCtx.fill()
      return
    }

    // Mask brush logic
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
      maskCtx.drawImage(brushTexture, x - brushRadius, y - brushRadius)
      return
    }

    // For max hardness, use solid fill to avoid anti-aliasing
    if (hardness === 1) {
      const solidColor = isErasing
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`

      maskCtx.fillStyle = solidColor
      maskCtx.beginPath()
      if (brushType === BrushShape.Rect) {
        maskCtx.rect(
          x - brushRadius,
          y - brushRadius,
          brushRadius * 2,
          brushRadius * 2
        )
      } else {
        maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2, false)
      }
      maskCtx.fill()
      return
    }

    // For soft brushes, use gradient
    let gradient = maskCtx.createRadialGradient(x, y, 0, x, y, brushRadius)

    if (isErasing) {
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
      gradient.addColorStop(hardness, `rgba(255, 255, 255, ${opacity * 0.5})`)
      gradient.addColorStop(1, `rgba(255, 255, 255, 0)`)
    } else {
      gradient.addColorStop(
        0,
        `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity})`
      )
      gradient.addColorStop(
        hardness,
        `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, ${opacity * 0.5})`
      )
      gradient.addColorStop(
        1,
        `rgba(${maskColor.r}, ${maskColor.g}, ${maskColor.b}, 0)`
      )
    }

    maskCtx.fillStyle = gradient
    maskCtx.beginPath()
    if (brushType === BrushShape.Rect) {
      maskCtx.rect(
        x - brushRadius,
        y - brushRadius,
        brushRadius * 2,
        brushRadius * 2
      )
    } else {
      maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2, false)
    }
    maskCtx.fill()
  }

  private formatRgba(hex: string, alpha: number): string {
    const { r, g, b } = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  private async init_shape(compositionOperation: CompositionOperation) {
    const maskBlendMode =
      await this.messageBroker.pull<MaskBlendMode>('maskBlendMode')
    const maskCtx =
      this.maskCtx ||
      (await this.messageBroker.pull<CanvasRenderingContext2D>('maskCtx'))
    const rgbCtx =
      this.rgbCtx ||
      (await this.messageBroker.pull<CanvasRenderingContext2D>('rgbCtx'))

    maskCtx.beginPath()
    rgbCtx.beginPath()

    // For both contexts, set the composite operation based on the passed parameter
    // This ensures right-click always works for erasing
    if (compositionOperation == CompositionOperation.SourceOver) {
      maskCtx.fillStyle = maskBlendMode
      maskCtx.globalCompositeOperation = CompositionOperation.SourceOver
      rgbCtx.globalCompositeOperation = CompositionOperation.SourceOver
    } else if (compositionOperation == CompositionOperation.DestinationOut) {
      maskCtx.globalCompositeOperation = CompositionOperation.DestinationOut
      rgbCtx.globalCompositeOperation = CompositionOperation.DestinationOut
    }
  }

  private generateEquidistantPoints(
    points: Point[],
    distance: number
  ): Point[] {
    const result: Point[] = []
    const cumulativeDistances: number[] = [0]

    // Calculate cumulative distances between points
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

      // Find the segment where the target distance falls
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

  private setBrushSize(size: number) {
    this.brushSettings.size = size
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushOpacity(opacity: number) {
    this.brushSettings.opacity = opacity
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushHardness(hardness: number) {
    this.brushSettings.hardness = hardness
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushType(type: BrushShape) {
    this.brushSettings.type = type
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }

  private setBrushSmoothingPrecision(precision: number) {
    this.brushSettings.smoothingPrecision = precision
    saveBrushToCache('maskeditor_brush_settings', this.brushSettings)
  }
}

export { BrushTool }
