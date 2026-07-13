import { useElementSize } from '@vueuse/core'
import { cloneDeep, isEqual } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import type { Ref, ShallowRef } from 'vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import {
  applyDrag,
  boxesAt,
  fromBoundingBoxes,
  tagRects,
  toBoundingBoxes
} from '@/composables/boundingBoxes/boundingBoxesUtil'
import type {
  HitMode,
  Region
} from '@/composables/boundingBoxes/boundingBoxesUtil'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeOutputWith } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { BoundingBox } from '@/types/boundingBoxes'
import type { NodeId } from '@/types/nodeId'
import { readableTextColor, textOnColor } from '@/utils/colorUtil'

const HANDLE_PX = 8
const DIMENSION_STEP = 16
const BG_DIM = 0.75
const MAX_ELEMENT_COLORS = 5
const GRID_PX = 32
const MAX_GRID_CELLS = 64
const DOT_ALPHA = 0.18
const DOT_RADIUS = 1

interface InlineEditorState {
  value: string
  style: Record<string, string>
  index: number
}

interface UseBoundingBoxesOptions {
  canvasEl: Readonly<ShallowRef<HTMLCanvasElement | null>>
  canvasContainer: Readonly<ShallowRef<HTMLDivElement | null>>
  inlineEditorEl: Readonly<ShallowRef<HTMLTextAreaElement | null>>
  modelValue: Ref<BoundingBox[]>
}

export function useBoundingBoxes(
  nodeId: NodeId,
  {
    canvasEl,
    canvasContainer,
    inlineEditorEl,
    modelValue
  }: UseBoundingBoxesOptions
) {
  const focused = ref(false)
  const drawing = ref(false)
  const dragMode = ref<HitMode | null>(null)
  const dragStartNorm = ref<{ x: number; y: number } | null>(null)
  const boxAtStart = ref<Region | null>(null)
  const hoverIndex = ref<number | null>(null)
  const hoverTagIndex = ref<number | null>(null)
  const bgImage = ref<HTMLImageElement | null>(null)
  const inlineEditor = ref<InlineEditorState | null>(null)
  const grid = ref(true)

  const { width: containerWidth } = useElementSize(canvasContainer)

  const litegraphNode = computed(() =>
    nodeId && app.canvas?.graph ? app.canvas.graph.getNodeById(nodeId) : null
  )
  const { selectedNodeIds } = storeToRefs(useCanvasStore())
  const isNodeSelected = computed(() => selectedNodeIds.value.has(nodeId))

  function dimWidget(name: 'width' | 'height'): number | undefined {
    const v = litegraphNode.value?.widgets?.find((w) => w.name === name)?.value
    return typeof v === 'number' && v > 0 ? v : undefined
  }
  const widthValue = computed(() => dimWidget('width') ?? 1024)
  const heightValue = computed(() => dimWidget('height') ?? 1024)

  const state = ref({
    regions: fromBoundingBoxes(
      modelValue.value ?? [],
      widthValue.value,
      heightValue.value
    )
  })
  const activeIndex = ref(state.value.regions.length ? 0 : -1)

  const aspectRatio = computed(
    () => `${widthValue.value} / ${heightValue.value}`
  )
  const canvasStyle = computed(() => ({ aspectRatio: aspectRatio.value }))

  const activeRegion = computed(() =>
    activeIndex.value >= 0 ? state.value.regions[activeIndex.value] : null
  )
  const hasRegions = computed(() => state.value.regions.length > 0)

  function clampToCanvas(n: number) {
    return Math.max(0, Math.min(1, n))
  }

  function gridSpec() {
    const axisFraction = (size: number) =>
      Math.max(GRID_PX, Math.ceil(size / MAX_GRID_CELLS)) / size
    return {
      fx: axisFraction(widthValue.value),
      fy: axisFraction(heightValue.value)
    }
  }

  function snapFraction(value: number, step: number) {
    return step > 0 ? clampToCanvas(Math.round(value / step) * step) : value
  }

  function snapRegion(region: Region, mode: HitMode): Region {
    if (!grid.value) return region
    const { fx, fy } = gridSpec()
    if (mode === 'move') {
      return {
        ...region,
        x: Math.min(snapFraction(region.x, fx), 1 - region.w),
        y: Math.min(snapFraction(region.y, fy), 1 - region.h)
      }
    }
    const snapLeft =
      mode === 'draw' ||
      mode === 'resize-l' ||
      mode === 'resize-tl' ||
      mode === 'resize-bl'
    const snapRight =
      mode === 'draw' ||
      mode === 'resize-r' ||
      mode === 'resize-tr' ||
      mode === 'resize-br'
    const snapTop =
      mode === 'draw' ||
      mode === 'resize-t' ||
      mode === 'resize-tl' ||
      mode === 'resize-tr'
    const snapBottom =
      mode === 'draw' ||
      mode === 'resize-b' ||
      mode === 'resize-bl' ||
      mode === 'resize-br'
    const x1 = snapLeft ? snapFraction(region.x, fx) : region.x
    const y1 = snapTop ? snapFraction(region.y, fy) : region.y
    const x2 = snapRight
      ? snapFraction(region.x + region.w, fx)
      : region.x + region.w
    const y2 = snapBottom
      ? snapFraction(region.y + region.h, fy)
      : region.y + region.h
    return {
      ...region,
      x: x1,
      y: y1,
      w: Math.max(0, x2 - x1),
      h: Math.max(0, y2 - y1)
    }
  }

  function drawDots(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const el = canvasEl.value
    if (!el) return
    const { fx, fy } = gridSpec()
    if (fx <= 0 || fy <= 0) return
    const cols = Math.round(1 / fx)
    const rows = Math.round(1 / fy)
    ctx.save()
    ctx.globalAlpha = DOT_ALPHA
    ctx.fillStyle = getComputedStyle(el).color
    ctx.beginPath()
    for (let i = 0; i <= cols; i++) {
      const cx = Math.min(1, i * fx) * W
      for (let j = 0; j <= rows; j++) {
        const cy = Math.min(1, j * fy) * H
        ctx.moveTo(cx + DOT_RADIUS, cy)
        ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2)
      }
    }
    ctx.fill()
    ctx.restore()
  }

  function logicalSize() {
    const el = canvasEl.value
    return { w: el?.clientWidth || 1, h: el?.clientHeight || 1 }
  }

  function pointerNorm(e: PointerEvent) {
    const el = canvasEl.value
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return {
      x: clampToCanvas((e.clientX - r.left) / r.width),
      y: clampToCanvas((e.clientY - r.top) / r.height)
    }
  }

  let rafHandle = 0
  function requestDraw() {
    if (rafHandle) return
    rafHandle = requestAnimationFrame(() => {
      rafHandle = 0
      drawCanvas()
    })
  }

  function measureWidth(ctx: CanvasRenderingContext2D, s: string) {
    return ctx.measureText(s).width
  }

  function drawCanvas() {
    const el = canvasEl.value
    if (!el) return
    const { w: W, h: H } = logicalSize()
    const dpr = window.devicePixelRatio || 1
    const bw = Math.max(1, Math.round(W * dpr))
    const bh = Math.max(1, Math.round(H * dpr))
    if (el.width !== bw || el.height !== bh) {
      el.width = bw
      el.height = bh
    }
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    if (bgImage.value) {
      ctx.drawImage(bgImage.value, 0, 0, W, H)
      ctx.fillStyle = `rgba(0,0,0,${BG_DIM})`
      ctx.fillRect(0, 0, W, H)
    }

    if (grid.value) drawDots(ctx, W, H)

    const showActive = focused.value || isNodeSelected.value
    const aIdx = showActive ? activeIndex.value : -1
    const order = state.value.regions
      .map((_, i) => i)
      .filter((i) => i !== aIdx)
      .reverse()
    if (aIdx >= 0 && aIdx < state.value.regions.length) order.push(aIdx)

    ctx.font = 'bold 11px monospace'
    const tag_rects = tagRects(state.value.regions, W, H, (s) =>
      measureWidth(ctx, s)
    )

    for (const i of order) {
      const b = state.value.regions[i]
      const active = i === aIdx
      const pal = (b.palette || []).filter(Boolean)
      const col = pal.length ? pal[0] : '#8c8c8c'
      const x1 = b.x * W
      const y1 = b.y * H
      const x2 = (b.x + b.w) * W
      const y2 = (b.y + b.h) * H
      const w = x2 - x1
      const h = y2 - y1
      const hovered = i === hoverIndex.value || active

      if (active) {
        ctx.fillStyle = 'rgba(26,26,26,0.88)'
        ctx.fillRect(x1, y1, w, h)
      }
      ctx.fillStyle = col + (hovered ? '3a' : '22')
      ctx.fillRect(x1, y1, w, h)

      const lw = active ? 2 : hovered ? 1.5 : 1
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.strokeRect(x1 + lw / 2, y1 + lw / 2, w - lw, h - lw)

      if (pal.length) {
        const sw = w / pal.length
        const sh = 7
        for (let p = 0; p < pal.length; p++) {
          const sx = x1 + Math.round(p * sw)
          ctx.fillStyle = pal[p]
          ctx.fillRect(sx, y1, x1 + Math.round((p + 1) * sw) - sx, sh)
        }
      }

      ctx.save()
      ctx.beginPath()
      ctx.rect(x1, y1, w, h)
      ctx.clip()

      let body = b.desc || ''
      if (b.type === 'text' && b.text)
        body = `"${b.text}"` + (body ? ` — ${body}` : '')
      if (body) {
        ctx.font = '12px monospace'
        ctx.fillStyle = readableTextColor(col)
        const pad = 4
        const lh = 14
        let ty = y1 + 15 + 12
        for (const line of wrapLines(ctx, body, w - pad * 2)) {
          if (ty > y1 + h) break
          ctx.fillText(line, x1 + pad, ty)
          ty += lh
        }
      }

      const tr = tag_rects[i]
      ctx.font = 'bold 11px monospace'
      ctx.fillStyle = col
      ctx.fillRect(tr.x, tr.y, tr.w, 14)
      if (i === hoverTagIndex.value) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillRect(tr.x, tr.y, tr.w, 14)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w - 1, 13)
      }
      ctx.fillStyle = textOnColor(col)
      ctx.fillText(tr.tag, tr.x + 4, tr.y + 11)
      ctx.restore()
    }
  }

  function wrapLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxW: number
  ): string[] {
    const out: string[] = []
    for (const para of text.split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/)) {
        if (!word) continue
        const test = line ? `${line} ${word}` : word
        if (line && ctx.measureText(test).width > maxW) {
          out.push(line)
          line = word
        } else {
          line = test
        }
      }
      out.push(line)
    }
    return out
  }

  const hitTestPoint = (mN: { x: number; y: number }) => {
    const { w: W, h: H } = logicalSize()
    const cands = boxesAt(
      state.value.regions,
      mN.x,
      mN.y,
      HANDLE_PX,
      W,
      H,
      activeIndex.value
    )
    if (!cands.length) return null
    return (
      cands.find((c) => c.index === activeIndex.value && c.mode !== 'move') ||
      cands[0]
    )
  }

  const titleAt = (mN: { x: number; y: number }) => {
    const el = canvasEl.value
    if (!el) return null
    const ctx = el.getContext('2d')
    if (!ctx) return null
    const { w: W, h: H } = logicalSize()
    const rects = tagRects(state.value.regions, W, H, (s) =>
      measureWidth(ctx, s)
    )
    const px = mN.x * W
    const py = mN.y * H
    for (let i = state.value.regions.length - 1; i >= 0; i--) {
      const r = rects[i]
      if (r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)
        return i
    }
    return null
  }

  function pickForSelection(mN: { x: number; y: number }, cycle: boolean) {
    const { w: W, h: H } = logicalSize()
    const cands = boxesAt(
      state.value.regions,
      mN.x,
      mN.y,
      HANDLE_PX,
      W,
      H,
      activeIndex.value
    )
    if (!cands.length) return null
    const activeResize = cands.find(
      (c) => c.index === activeIndex.value && c.mode !== 'move'
    )
    if (activeResize && !cycle) return activeResize
    const ti = titleAt(mN)
    if (ti !== null && !cycle) return { index: ti, mode: 'move' as HitMode }
    if (cycle && cands.length > 1) {
      const pos = cands.findIndex((c) => c.index === activeIndex.value)
      return cands[(pos + 1) % cands.length]
    }
    return (
      cands.find((c) => c.index === activeIndex.value && c.mode !== 'move') ||
      cands[0]
    )
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    canvasEl.value?.focus()
    hoverTagIndex.value = null
    hoverIndex.value = null
    const mN = pointerNorm(e)
    const hit = pickForSelection(mN, e.altKey)
    if (hit) {
      activeIndex.value = hit.index
      dragMode.value = hit.mode
      boxAtStart.value = { ...state.value.regions[hit.index] }
    } else {
      dragMode.value = 'draw'
      const nb: Region = {
        x: mN.x,
        y: mN.y,
        w: 0,
        h: 0,
        type: 'obj',
        text: '',
        desc: '',
        palette: []
      }
      state.value.regions.push(nb)
      activeIndex.value = state.value.regions.length - 1
      boxAtStart.value = { ...nb }
    }
    drawing.value = true
    dragStartNorm.value = mN
    canvasEl.value?.setPointerCapture(e.pointerId)
    e.preventDefault()
    requestDraw()
  }

  function onDocPointerMove(e: PointerEvent) {
    if (
      !drawing.value ||
      !boxAtStart.value ||
      !dragStartNorm.value ||
      !dragMode.value
    )
      return
    const mN = pointerNorm(e)
    const dx = mN.x - dragStartNorm.value.x
    const dy = mN.y - dragStartNorm.value.y
    const nb = applyDrag(dragMode.value, boxAtStart.value, dx, dy)
    state.value.regions[activeIndex.value] = snapRegion(nb, dragMode.value)
    requestDraw()
  }

  function onDocPointerUp(e: PointerEvent) {
    if (!drawing.value) return
    drawing.value = false
    canvasEl.value?.releasePointerCapture?.(e.pointerId)
    const b = state.value.regions[activeIndex.value]
    if (b && (b.w < 0.005 || b.h < 0.005)) {
      removeRegion(activeIndex.value)
    }
    syncState()
  }

  function onCanvasPointerMove(e: PointerEvent) {
    if (drawing.value) onDocPointerMove(e)
    else onPointerMove(e)
  }

  function onPointerMove(e: PointerEvent) {
    if (drawing.value) return
    const mN = pointerNorm(e)
    const ti = titleAt(mN)
    const hit = hitTestPoint(mN)
    const hb = ti !== null ? ti : hit ? hit.index : null
    if (ti !== hoverTagIndex.value || hb !== hoverIndex.value) {
      hoverTagIndex.value = ti
      hoverIndex.value = hb
      requestDraw()
    }
  }

  function onPointerLeave() {
    if (hoverTagIndex.value !== null || hoverIndex.value !== null) {
      hoverTagIndex.value = null
      hoverIndex.value = null
      requestDraw()
    }
  }

  const canvasCursor = computed(() =>
    hoverTagIndex.value !== null ? 'pointer' : 'crosshair'
  )

  function onDoubleClick(e: MouseEvent) {
    e.preventDefault()
    const mN = pointerNormFromMouse(e)
    const { w: W, h: H } = logicalSize()
    const cands = boxesAt(
      state.value.regions,
      mN.x,
      mN.y,
      HANDLE_PX,
      W,
      H,
      activeIndex.value
    )
    const target = cands.find((c) => c.index === activeIndex.value) || cands[0]
    if (!target) return
    openInlineEditor(target.index)
  }

  function pointerNormFromMouse(e: MouseEvent) {
    const el = canvasEl.value
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return {
      x: clampToCanvas((e.clientX - r.left) / r.width),
      y: clampToCanvas((e.clientY - r.top) / r.height)
    }
  }

  function openInlineEditor(index: number) {
    const b = state.value.regions[index]
    if (!b) return
    activeIndex.value = index
    const { w: W, h: H } = logicalSize()
    const w = Math.min(W, Math.max(70, b.w * W))
    const h = Math.min(H, Math.max(42, b.h * H))
    const left = Math.max(0, Math.min(b.x * W, W - w))
    const top = Math.max(0, Math.min(b.y * H, H - h))
    inlineEditor.value = {
      value: b.desc || '',
      index,
      style: {
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        height: `${h}px`,
        borderColor: (b.palette || []).find(Boolean) || '#46b4e6'
      }
    }
    void nextTick(() => {
      inlineEditorEl.value?.focus()
      inlineEditorEl.value?.select()
    })
  }

  function onInlineKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      inlineEditor.value = null
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      commitInlineEditor()
    }
  }

  function commitInlineEditor() {
    const ed = inlineEditor.value
    if (!ed) return
    const b = state.value.regions[ed.index]
    if (b) b.desc = ed.value
    inlineEditor.value = null
    syncState()
  }

  function onCanvasKeyDown(e: KeyboardEvent) {
    if (drawing.value) return
    const idx = activeIndex.value
    if ((e.key === 'Delete' || e.key === 'Backspace') && idx >= 0) {
      e.preventDefault()
      e.stopPropagation()
      removeRegion(idx)
      syncState()
    }
  }

  function removeRegion(i: number) {
    state.value.regions.splice(i, 1)
    if (!state.value.regions.length) activeIndex.value = -1
    else if (i <= activeIndex.value)
      activeIndex.value = Math.max(0, activeIndex.value - 1)
  }

  function setActiveType(t: 'obj' | 'text') {
    if (activeRegion.value) {
      activeRegion.value.type = t
      syncState()
    }
  }

  function clearAll() {
    state.value.regions = []
    activeIndex.value = -1
    setLastIncoming([])
    syncState()
  }

  function syncState() {
    modelValue.value = toBoundingBoxes(
      state.value.regions,
      widthValue.value,
      heightValue.value
    )
    requestDraw()
  }

  watch(containerWidth, () => requestDraw())
  watch(
    () => state.value.regions.length,
    () => requestDraw()
  )
  watch(isNodeSelected, () => requestDraw())
  watch([widthValue, heightValue], () => syncState())

  watch(
    litegraphNode,
    (node) => {
      const props = node?.properties as { bboxGrid?: unknown } | undefined
      if (props && typeof props.bboxGrid === 'boolean')
        grid.value = props.bboxGrid
    },
    { immediate: true }
  )
  watch(grid, (enabled) => {
    const props = litegraphNode.value?.properties as
      | Record<string, unknown>
      | undefined
    if (props) props.bboxGrid = enabled
    requestDraw()
  })

  const nodeOutputStore = useNodeOutputStore()
  function applyImageDimensions(naturalWidth: number, naturalHeight: number) {
    const node = litegraphNode.value
    if (!node) return
    const snap = (v: number) =>
      Math.max(DIMENSION_STEP, Math.round(v / DIMENSION_STEP) * DIMENSION_STEP)
    const targetW = snap(naturalWidth)
    const targetH = snap(naturalHeight)
    const widthWidget = node.widgets?.find((w) => w.name === 'width')
    const heightWidget = node.widgets?.find((w) => w.name === 'height')
    if (widthWidget && widthWidget.value !== targetW) {
      widthWidget.value = targetW
      widthWidget.callback?.(targetW)
    }
    if (heightWidget && heightWidget.value !== targetH) {
      heightWidget.value = targetH
      heightWidget.callback?.(targetH)
    }
  }

  let lastBgUrl = ''
  function updateBgImage() {
    const node = litegraphNode.value
    if (!node) return
    const slot = node.findInputSlot('background')
    const inputNode = slot >= 0 ? node.getInputNode(slot) : null
    const url = inputNode
      ? nodeOutputStore.getNodeImageUrls(inputNode)?.[0]
      : undefined
    if (!url) {
      if (bgImage.value) {
        bgImage.value = null
        lastBgUrl = ''
        requestDraw()
      }
      return
    }
    if (url === lastBgUrl) return
    lastBgUrl = url
    const currentUrl = url
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (currentUrl !== lastBgUrl) return
      bgImage.value = img
      applyImageDimensions(img.naturalWidth, img.naturalHeight)
      requestDraw()
    }
    img.src = url
  }
  function lastIncomingWidget() {
    return litegraphNode.value?.widgets?.find((w) => w.name === 'last_incoming')
  }

  function lastIncomingValue(): BoundingBox[] {
    const value = lastIncomingWidget()?.value
    return Array.isArray(value) ? (value as BoundingBox[]) : []
  }

  function setLastIncoming(boxes: BoundingBox[]) {
    const widget = lastIncomingWidget()
    if (!widget) return
    const next = cloneDeep(boxes)
    widget.value = next
    widget.callback?.(next)
  }

  function applyIncomingBoxes(apply = true) {
    if (drawing.value) return
    const node = litegraphNode.value
    if (!node) return
    const slot = node.findInputSlot('bboxes')
    if (slot < 0 || !node.isInputConnected(slot)) return
    const outputs = nodeOutputStore.getNodeOutputs(node) as
      | NodeOutputWith<{ input_bboxes?: BoundingBox[] }>
      | undefined
    const incoming = outputs?.input_bboxes
    if (!incoming?.length) return
    const applied = lastIncomingValue()
    if (isEqual(incoming, applied)) return
    if (!apply) {
      if (!applied.length && state.value.regions.length)
        setLastIncoming(incoming)
      return
    }
    state.value.regions = fromBoundingBoxes(
      incoming,
      widthValue.value,
      heightValue.value
    )
    activeIndex.value = state.value.regions.length ? 0 : -1
    setLastIncoming(incoming)
    syncState()
  }

  watch(
    () => nodeOutputStore.nodeOutputs,
    () => {
      updateBgImage()
      applyIncomingBoxes()
    },
    { deep: true }
  )
  watch(() => nodeOutputStore.nodePreviewImages, updateBgImage, { deep: true })

  updateBgImage()
  applyIncomingBoxes(false)
  void nextTick(() => requestDraw())

  onBeforeUnmount(() => {
    if (rafHandle) cancelAnimationFrame(rafHandle)
  })

  return {
    canvasStyle,
    canvasCursor,
    focused,
    activeRegion,
    hasRegions,
    inlineEditor,
    maxColors: MAX_ELEMENT_COLORS,
    onPointerDown,
    onCanvasPointerMove,
    onDocPointerUp,
    onPointerLeave,
    onDoubleClick,
    onCanvasKeyDown,
    onInlineKeyDown,
    commitInlineEditor,
    setActiveType,
    clearAll,
    syncState,
    grid
  }
}
