import type { Ref } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getEffectiveBrushSize,
  getEffectiveHardness
} from '@/composables/maskeditor/brushUtils'
import { StrokeProcessor } from '@/composables/maskeditor/StrokeProcessor'
import { hexToRgb } from '@/utils/colorUtil'
import type { Point } from '@/extensions/core/maskeditor/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isCloud } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

type PainterTool = 'brush' | 'eraser'

export const PAINTER_TOOLS: Record<string, PainterTool> = {
  BRUSH: 'brush',
  ERASER: 'eraser'
} as const

interface UsePainterOptions {
  canvasEl: Ref<HTMLCanvasElement | null>
  modelValue: Ref<string>
}

export function usePainter(nodeId: string, options: UsePainterOptions) {
  const { canvasEl, modelValue } = options
  const { t } = useI18n()
  const nodeOutputStore = useNodeOutputStore()

  const isDirty = ref(false)

  const canvasWidth = ref(512)
  const canvasHeight = ref(512)

  const cursorPos = ref({ x: 0, y: 0 })
  const cursorVisible = ref(false)

  const inputImageUrl = ref<string | null>(null)
  const isImageInputConnected = ref(false)

  let isDrawing = false
  let strokeProcessor: StrokeProcessor | null = null
  let lastPoint: Point | null = null

  let strokeCanvas: HTMLCanvasElement | null = null
  let strokeCtx: CanvasRenderingContext2D | null = null

  let baseCanvas: HTMLCanvasElement | null = null
  let baseCtx: CanvasRenderingContext2D | null = null
  let hasBaseSnapshot = false
  let hasStrokes = false

  const litegraphNode = computed(() => {
    if (!nodeId || !app.canvas.graph) return null
    return app.canvas.graph.getNodeById(nodeId) as LGraphNode | null
  })

  function getWidgetByName(name: string): IBaseWidget | undefined {
    return litegraphNode.value?.widgets?.find(
      (w: IBaseWidget) => w.name === name
    )
  }

  const tool = ref<PainterTool>(PAINTER_TOOLS.BRUSH)
  const brushSize = ref(20)
  const brushColor = ref('#ffffff')
  const brushOpacity = ref(1)
  const brushHardness = ref(1)
  const backgroundColor = ref('#000000')

  function restoreSettingsFromProperties() {
    const node = litegraphNode.value
    if (!node) return

    const props = node.properties
    if (props.painterTool != null) tool.value = props.painterTool as PainterTool
    if (props.painterBrushSize != null)
      brushSize.value = props.painterBrushSize as number
    if (props.painterBrushColor != null)
      brushColor.value = props.painterBrushColor as string
    if (props.painterBrushOpacity != null)
      brushOpacity.value = props.painterBrushOpacity as number
    if (props.painterBrushHardness != null)
      brushHardness.value = props.painterBrushHardness as number

    const bgColorWidget = getWidgetByName('bg_color')
    if (bgColorWidget) backgroundColor.value = bgColorWidget.value as string
  }

  function saveSettingsToProperties() {
    const node = litegraphNode.value
    if (!node) return

    node.properties.painterTool = tool.value
    node.properties.painterBrushSize = brushSize.value
    node.properties.painterBrushColor = brushColor.value
    node.properties.painterBrushOpacity = brushOpacity.value
    node.properties.painterBrushHardness = brushHardness.value
  }

  function syncCanvasSizeToWidgets() {
    const widthWidget = getWidgetByName('width')
    const heightWidget = getWidgetByName('height')

    if (widthWidget && widthWidget.value !== canvasWidth.value) {
      widthWidget.value = canvasWidth.value
      widthWidget.callback?.(canvasWidth.value)
    }
    if (heightWidget && heightWidget.value !== canvasHeight.value) {
      heightWidget.value = canvasHeight.value
      heightWidget.callback?.(canvasHeight.value)
    }
  }

  function syncBackgroundColorToWidget() {
    const bgColorWidget = getWidgetByName('bg_color')
    if (bgColorWidget && bgColorWidget.value !== backgroundColor.value) {
      bgColorWidget.value = backgroundColor.value
      bgColorWidget.callback?.(backgroundColor.value)
    }
  }

  function updateInputImageUrl() {
    const node = litegraphNode.value
    if (!node) {
      inputImageUrl.value = null
      isImageInputConnected.value = false
      return
    }

    isImageInputConnected.value = node.isInputConnected(0)

    const inputNode = node.getInputNode(0)
    if (!inputNode) {
      inputImageUrl.value = null
      return
    }

    const urls = nodeOutputStore.getNodeImageUrls(inputNode)
    inputImageUrl.value = urls?.length ? urls[0] : null
  }

  function syncCanvasSizeFromWidgets() {
    const w = getWidgetByName('width')
    const h = getWidgetByName('height')
    canvasWidth.value = (w?.value as number) ?? 512
    canvasHeight.value = (h?.value as number) ?? 512
  }

  function activeHardness(): number {
    return tool.value === PAINTER_TOOLS.ERASER ? 1 : brushHardness.value
  }

  const displayBrushSize = computed(() => {
    const el = canvasEl.value
    if (!el || !canvasWidth.value) return brushSize.value

    const radius = brushSize.value / 2
    const effectiveRadius = getEffectiveBrushSize(radius, activeHardness())
    const effectiveDiameter = effectiveRadius * 2
    return effectiveDiameter * (el.clientWidth / canvasWidth.value)
  })

  function getCtx() {
    return (
      canvasEl.value?.getContext('2d', { willReadFrequently: true }) ?? null
    )
  }

  function getCanvasPoint(e: PointerEvent): Point | null {
    const el = canvasEl.value
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * el.width,
      y: ((e.clientY - rect.top) / rect.height) * el.height
    }
  }

  function drawCircle(ctx: CanvasRenderingContext2D, point: Point) {
    const radius = brushSize.value / 2
    const hardness = activeHardness()
    const effectiveRadius = getEffectiveBrushSize(radius, hardness)
    const effectiveHardness = getEffectiveHardness(
      radius,
      hardness,
      effectiveRadius
    )

    ctx.beginPath()
    ctx.arc(point.x, point.y, effectiveRadius, 0, Math.PI * 2)

    if (hardness < 1) {
      const { r, g, b } = hexToRgb(brushColor.value)
      const gradient = ctx.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        effectiveRadius
      )
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
      gradient.addColorStop(effectiveHardness, `rgba(${r}, ${g}, ${b}, 1)`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = gradient
    }

    ctx.fill()
  }

  function drawSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
    const hardness = activeHardness()

    if (hardness < 1) {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.hypot(dx, dy)
      const radius = brushSize.value / 2
      const effectiveRadius = getEffectiveBrushSize(radius, hardness)
      const step = Math.max(1, effectiveRadius / 4)

      if (dist > 0) {
        const steps = Math.ceil(dist / step)
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const x = from.x + dx * t
          const y = from.y + dy * t
          drawCircle(ctx, { x, y })
        }
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      drawCircle(ctx, to)
    }
  }

  function applyBrushStyle(ctx: CanvasRenderingContext2D) {
    const radius = brushSize.value / 2
    const hardness = activeHardness()
    const effectiveRadius = getEffectiveBrushSize(radius, hardness)
    const effectiveDiameter = effectiveRadius * 2

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = brushColor.value
    ctx.strokeStyle = brushColor.value
    ctx.lineWidth = effectiveDiameter
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function ensureStrokeCanvas() {
    const el = canvasEl.value
    if (!el) return null

    if (
      !strokeCanvas ||
      strokeCanvas.width !== el.width ||
      strokeCanvas.height !== el.height
    ) {
      strokeCanvas = document.createElement('canvas')
      strokeCanvas.width = el.width
      strokeCanvas.height = el.height
      strokeCtx = strokeCanvas.getContext('2d', { willReadFrequently: true })
    }

    strokeCtx?.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height)
    return strokeCtx
  }

  function ensureBaseCanvas() {
    const el = canvasEl.value
    if (!el) return null

    if (
      !baseCanvas ||
      baseCanvas.width !== el.width ||
      baseCanvas.height !== el.height
    ) {
      baseCanvas = document.createElement('canvas')
      baseCanvas.width = el.width
      baseCanvas.height = el.height
      baseCtx = baseCanvas.getContext('2d')
    }

    return baseCtx
  }

  function compositeStrokeToMain(isPreview: boolean = false) {
    const el = canvasEl.value
    const ctx = getCtx()
    if (!el || !ctx || !strokeCanvas) return

    if (hasBaseSnapshot && baseCanvas) {
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.drawImage(baseCanvas, 0, 0)
    }

    ctx.save()
    const isEraser = tool.value === PAINTER_TOOLS.ERASER
    ctx.globalAlpha = isEraser ? 1 : brushOpacity.value
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.drawImage(strokeCanvas, 0, 0)
    ctx.restore()

    if (!isPreview) {
      hasBaseSnapshot = false
    }
  }

  function startStroke(e: PointerEvent) {
    const point = getCanvasPoint(e)
    if (!point) return

    const el = canvasEl.value
    if (!el) return

    const bCtx = ensureBaseCanvas()
    if (bCtx) {
      bCtx.clearRect(0, 0, el.width, el.height)
      bCtx.drawImage(el, 0, 0)
      hasBaseSnapshot = true
    }

    isDrawing = true
    isDirty.value = true
    hasStrokes = true
    strokeProcessor = new StrokeProcessor(Math.max(1, brushSize.value / 4))
    strokeProcessor.addPoint(point)
    lastPoint = point

    const ctx = ensureStrokeCanvas()
    if (!ctx) return
    ctx.save()
    applyBrushStyle(ctx)
    drawCircle(ctx, point)
    ctx.restore()

    compositeStrokeToMain(true)
  }

  function continueStroke(e: PointerEvent) {
    if (!isDrawing || !strokeProcessor || !strokeCtx) return

    const point = getCanvasPoint(e)
    if (!point) return

    const points = strokeProcessor.addPoint(point)
    if (points.length === 0 && lastPoint) {
      points.push(point)
    }

    if (points.length === 0) return

    strokeCtx.save()
    applyBrushStyle(strokeCtx)

    let prev = lastPoint ?? points[0]
    for (const p of points) {
      drawSegment(strokeCtx, prev, p)
      prev = p
    }
    lastPoint = prev

    strokeCtx.restore()

    compositeStrokeToMain(true)
  }

  function endStroke() {
    if (!isDrawing || !strokeProcessor) return

    const points = strokeProcessor.endStroke()
    if (strokeCtx && points.length > 0) {
      strokeCtx.save()
      applyBrushStyle(strokeCtx)
      let prev = lastPoint ?? points[0]
      for (const p of points) {
        drawSegment(strokeCtx, prev, p)
        prev = p
      }
      strokeCtx.restore()
    }

    compositeStrokeToMain()

    isDrawing = false
    strokeProcessor = null
    lastPoint = null
  }

  function resizeCanvas() {
    const el = canvasEl.value
    if (!el) return
    const prevData =
      el.width > 0 && el.height > 0
        ? getCtx()?.getImageData(0, 0, el.width, el.height)
        : null
    el.width = canvasWidth.value
    el.height = canvasHeight.value
    if (prevData) {
      getCtx()?.putImageData(prevData, 0, 0)
    }

    strokeCanvas = null
    strokeCtx = null
    baseCanvas = null
    baseCtx = null
    hasBaseSnapshot = false
  }

  function handleClear() {
    const el = canvasEl.value
    const ctx = getCtx()
    if (!el || !ctx) return
    ctx.clearRect(0, 0, el.width, el.height)
    isDirty.value = true
    hasStrokes = false
  }

  function updateCursorPos(e: PointerEvent) {
    cursorPos.value = { x: e.offsetX, y: e.offsetY }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateCursorPos(e)
    startStroke(e)
  }

  function handlePointerMove(e: PointerEvent) {
    updateCursorPos(e)
    continueStroke(e)
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.button !== 0) return
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    endStroke()
  }

  function handlePointerLeave() {
    cursorVisible.value = false
    endStroke()
  }

  function handlePointerEnter() {
    cursorVisible.value = true
  }

  function handleInputImageLoad(e: Event) {
    const img = e.target as HTMLImageElement
    const widthWidget = getWidgetByName('width')
    const heightWidget = getWidgetByName('height')
    if (widthWidget) {
      widthWidget.value = img.naturalWidth
      widthWidget.callback?.(img.naturalWidth)
    }
    if (heightWidget) {
      heightWidget.value = img.naturalHeight
      heightWidget.callback?.(img.naturalHeight)
    }
    canvasWidth.value = img.naturalWidth
    canvasHeight.value = img.naturalHeight
  }

  function parseMaskFilename(value: string): {
    filename: string
    subfolder: string
    type: string
  } | null {
    const trimmed = value?.trim()
    if (!trimmed) return null

    const typeMatch = trimmed.match(/^(.+?) \[([^\]]+)\]$/)
    const pathPart = typeMatch ? typeMatch[1] : trimmed
    const type = typeMatch ? typeMatch[2] : 'input'

    const lastSlash = pathPart.lastIndexOf('/')
    const subfolder = lastSlash !== -1 ? pathPart.substring(0, lastSlash) : ''
    const filename =
      lastSlash !== -1 ? pathPart.substring(lastSlash + 1) : pathPart

    return { filename, subfolder, type }
  }

  function isCanvasEmpty(): boolean {
    if (!hasStrokes) return true
    const el = canvasEl.value
    const ctx = getCtx()
    if (!el || !ctx) return true
    const imageData = ctx.getImageData(0, 0, el.width, el.height)

    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) return false
    }
    return true
  }

  async function serializeValue(): Promise<string> {
    const el = canvasEl.value
    if (!el) return ''

    if (isCanvasEmpty()) return ''

    if (!isDirty.value) return modelValue.value

    const blob = await new Promise<Blob | null>((resolve) =>
      el.toBlob(resolve, 'image/png')
    )
    if (!blob) return modelValue.value

    const name = `painter-${nodeId}-${Date.now()}.png`
    const file = new File([blob], name)
    const body = new FormData()
    body.append('image', file)
    if (!isCloud) body.append('subfolder', 'painter')
    body.append('type', isCloud ? 'input' : 'temp')

    let resp: Response
    try {
      resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })
    } catch (e) {
      const err = t('painter.uploadError', {
        status: 0,
        statusText: e instanceof Error ? e.message : String(e)
      })
      useToastStore().addAlert(err)
      throw new Error(err)
    }

    if (resp.status !== 200) {
      const err = t('painter.uploadError', {
        status: resp.status,
        statusText: resp.statusText
      })
      useToastStore().addAlert(err)
      throw new Error(err)
    }

    let data: { name: string }
    try {
      data = await resp.json()
    } catch (e) {
      const err = t('painter.uploadError', {
        status: resp.status,
        statusText: e instanceof Error ? e.message : String(e)
      })
      useToastStore().addAlert(err)
      throw new Error(err)
    }

    const result = isCloud
      ? `${data.name} [input]`
      : `painter/${data.name} [temp]`
    modelValue.value = result
    isDirty.value = false
    return result
  }

  function registerWidgetSerialization() {
    const node = litegraphNode.value
    if (!node?.widgets) return
    const targetWidget = node.widgets.find(
      (w: IBaseWidget) => w.name === 'mask'
    )
    if (targetWidget) {
      targetWidget.serializeValue = serializeValue
    }
  }

  function restoreCanvas() {
    const parsed = parseMaskFilename(modelValue.value)
    if (!parsed) return

    const params = new URLSearchParams()
    params.set('filename', parsed.filename)
    if (parsed.subfolder) params.set('subfolder', parsed.subfolder)
    params.set('type', parsed.type)

    const url = api.apiURL('/view?' + params.toString())
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const el = canvasEl.value
      const ctx = getCtx()
      if (!el || !ctx) return
      el.width = img.naturalWidth
      el.height = img.naturalHeight
      canvasWidth.value = img.naturalWidth
      canvasHeight.value = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      isDirty.value = false
      hasStrokes = true
    }
    img.onerror = () => {
      modelValue.value = ''
    }
    img.src = url
  }

  watch(() => nodeOutputStore.nodeOutputs, updateInputImageUrl, { deep: true })
  watch(() => nodeOutputStore.nodePreviewImages, updateInputImageUrl, {
    deep: true
  })
  watch([canvasWidth, canvasHeight], resizeCanvas)

  watch(
    [tool, brushSize, brushColor, brushOpacity, brushHardness],
    saveSettingsToProperties
  )

  watch([canvasWidth, canvasHeight], syncCanvasSizeToWidgets)

  watch(backgroundColor, syncBackgroundColorToWidget)

  function initialize() {
    syncCanvasSizeFromWidgets()
    resizeCanvas()
    registerWidgetSerialization()
    restoreSettingsFromProperties()
    updateInputImageUrl()
    restoreCanvas()
  }

  onMounted(initialize)

  return {
    tool,
    brushSize,
    brushColor,
    brushOpacity,
    brushHardness,
    backgroundColor,

    canvasWidth,
    canvasHeight,

    cursorPos,
    cursorVisible,
    displayBrushSize,

    inputImageUrl,
    isImageInputConnected,

    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerEnter,
    handlePointerLeave,

    handleInputImageLoad,
    handleClear
  }
}
