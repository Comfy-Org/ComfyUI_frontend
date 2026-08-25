import { clamp } from 'es-toolkit'
import { computed, reactive, ref } from 'vue'

import {
  BakeRasterCommand,
  snapshotRaster
} from '@/renderer/extensions/layerEditor/engine/commands/bakeContent'
import { PropCommand } from '@/renderer/extensions/layerEditor/engine/commands/prop'
import { SetTransformCommand } from '@/renderer/extensions/layerEditor/engine/commands/setTransform'
import type { Compositor } from '@/renderer/extensions/layerEditor/engine/compositor'
import { createWebGLCompositor } from '@/renderer/extensions/layerEditor/engine/compositor/webglCompositor'
import {
  filterTopmost,
  findNode
} from '@/renderer/extensions/layerEditor/engine/document'
import { createEditor } from '@/renderer/extensions/layerEditor/engine/editor/editor'
import type { AlphaSampler } from '@/renderer/extensions/layerEditor/engine/editor/pickOps'
import { pickLayerAt } from '@/renderer/extensions/layerEditor/engine/editor/pickOps'
import { Dirty } from '@/renderer/extensions/layerEditor/engine/history'
import type { FillSpec } from '@/renderer/extensions/layerEditor/engine/fill'
import {
  fillKind,
  rasterKind,
  registerBuiltinKinds
} from '@/renderer/extensions/layerEditor/engine/kinds'
import type { BlendFn } from '@/renderer/extensions/layerEditor/engine/mode'
import {
  LAYER_MODES,
  defaultMode
} from '@/renderer/extensions/layerEditor/engine/mode'
import type {
  FillData,
  Rect,
  SceneNode,
  Transform,
  Vec2
} from '@/renderer/extensions/layerEditor/engine/node'
import { placedBounds } from '@/renderer/extensions/layerEditor/engine/render/bake'
import type { OutsideCanvasPreviewLayer } from '@/renderer/extensions/layerEditor/engine/render/outsideCanvasPreview'
import { drawOutsideCanvasPreview } from '@/renderer/extensions/layerEditor/engine/render/outsideCanvasPreview'
import type { CanvasItem } from '@/renderer/extensions/layerEditor/engine/tool'
import { registerBuiltinTools } from '@/renderer/extensions/layerEditor/engine/tools'
import { canTransformNode } from '@/renderer/extensions/layerEditor/engine/tools/transformTool'
import {
  hitHandle,
  unionBounds
} from '@/renderer/extensions/layerEditor/engine/tools/transformMath'
import { createPanZoom } from '@/renderer/extensions/layerEditor/panZoom'

export type LayerEditorPointerMode = 'pointer' | 'hand'
export type LayerEditorAlignOp =
  | 'left'
  | 'centerH'
  | 'right'
  | 'top'
  | 'centerV'
  | 'bottom'

export const CANVAS_SIZE_MIN = 64
export const CANVAS_SIZE_MAX = 8192

export const DEFAULT_BACKGROUND_COLOR = '#ffffff'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export interface LayerEditorSessionOptions {
  createCompositor?: () => Compositor
  loadImage?: (url: string) => Promise<HTMLCanvasElement>
  alphaSampler?: AlphaSampler
}

export interface LayerEditorElements {
  viewport: HTMLElement
  container: HTMLElement
  main: HTMLCanvasElement
  overlay: HTMLCanvasElement
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load image: ${url}`))
    img.src = url
  })
}

async function defaultLoadImage(url: string): Promise<HTMLCanvasElement> {
  const img = await loadImageElement(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  canvas.getContext('2d')?.drawImage(img, 0, 0)
  return canvas
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(el?.isContentEditable)
}

function sameTransform(a: Transform, b: Transform): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h &&
    a.rotation === b.rotation
  )
}

function visualBounds(t: Transform): Rect {
  return t.rotation === 0 ? { x: t.x, y: t.y, w: t.w, h: t.h } : placedBounds(t)
}

function flipCanvasAxis(
  src: HTMLCanvasElement,
  axis: 'h' | 'v'
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (axis === 'h') {
    ctx.translate(src.width, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(0, src.height)
    ctx.scale(1, -1)
  }
  ctx.drawImage(src, 0, 0)
  return canvas
}

export type LayerEditorSession = ReturnType<typeof useLayerEditorSession>

export function useLayerEditorSession(opts: LayerEditorSessionOptions = {}) {
  registerBuiltinKinds()
  registerBuiltinTools()

  const loadImage = opts.loadImage ?? defaultLoadImage
  const version = ref(0)
  const activeNodeId = ref<string | null>(null)
  const glOk = ref(true)
  const zoomRatio = ref(1)
  const spaceDown = ref(false)
  const hoverCursor = ref('default')
  const pointerMode = ref<LayerEditorPointerMode>('pointer')
  const panning = ref(false)

  const flipParity = reactive(new Map<string, { h: boolean; v: boolean }>())
  const inputOrderIds: string[] = []

  const compositor = (opts.createCompositor ?? createWebGLCompositor)()
  let onContextRestored: (() => void) | null = null
  glOk.value = compositor.init({
    width: 1024,
    height: 1024,
    onContextRestored: () => onContextRestored?.()
  })
  const editor = createEditor({ compositor, onChange })
  onContextRestored = () => editor.invalidate()
  const content = editor.content

  let mainCanvas: HTMLCanvasElement | null = null
  let overlayCanvas: HTMLCanvasElement | null = null
  let viewportEl: HTMLElement | null = null
  let containerEl: HTMLElement | null = null
  const panZoom = createPanZoom(() =>
    viewportEl && containerEl
      ? { viewport: viewportEl, container: containerEl }
      : null
  )
  panZoom.onChange(() => {
    zoomRatio.value = panZoom.zoom()
  })

  const layers = computed<SceneNode[]>(() => {
    void version.value
    return [...editor.document().root.children]
  })
  const backgroundLayer = computed<FillData | null>(() => {
    const first = layers.value[0]
    return first?.kind === 'fill' ? { ...first } : null
  })
  const imageLayers = computed<SceneNode[]>(() =>
    layers.value.filter((n) => n.kind !== 'fill')
  )
  const activeNode = computed<SceneNode | null>(() => {
    void version.value
    const node = activeNodeId.value ? engineNode(activeNodeId.value) : null
    return node ? { ...node } : null
  })
  const selectedNodeIds = computed<string[]>(() => {
    void version.value
    return editor.selectedNodeIds()
  })
  const canUndo = computed(() => version.value >= 0 && editor.history.canUndo())
  const canRedo = computed(() => version.value >= 0 && editor.history.canRedo())
  const selectedContext = computed<'background' | 'layer'>(() => {
    void version.value
    const node = activeNodeId.value ? engineNode(activeNodeId.value) : null
    return node && node.kind !== 'fill' ? 'layer' : 'background'
  })
  const canvasSize = computed<{ w: number; h: number }>(() => {
    void version.value
    const doc = editor.document()
    return { w: doc.width, h: doc.height }
  })

  function engineNode(id: string): SceneNode | null {
    return findNode(editor.document().root, id)?.node ?? null
  }

  function backgroundNode(): FillData | null {
    const first = editor.document().root.children[0]
    return first?.kind === 'fill' ? first : null
  }

  function onChange(): void {
    version.value += 1
    activeNodeId.value = editor.activeNodeId()
    requestRender()
  }

  function present(): void {
    if (!mainCanvas) return
    const { width, height } = editor.document()
    const resized = mainCanvas.width !== width || mainCanvas.height !== height
    if (resized) {
      mainCanvas.width = width
      mainCanvas.height = height
    }
    const ctx = mainCanvas.getContext('2d')
    if (!ctx) return
    if (!glOk.value) {
      ctx.clearRect(0, 0, width, height)
      return
    }
    editor.setZoom(Math.max(0.01, panZoom.zoom()))
    const dmg = editor.takePresentDamage()
    const clean = !dmg.full && !dmg.rect
    if (clean && !resized) return
    if (dmg.rect && !dmg.full && !resized) {
      const img = compositor.readback(dmg.rect)
      ctx.putImageData(
        img,
        Math.max(0, Math.floor(dmg.rect.x)),
        Math.max(0, Math.floor(dmg.rect.y))
      )
      return
    }
    ctx.clearRect(0, 0, width, height)
    editor.render()
    ctx.putImageData(compositor.readback(), 0, 0)
  }

  function drawItem(
    ctx: CanvasRenderingContext2D,
    item: CanvasItem,
    hs: number
  ): void {
    switch (item.type) {
      case 'handle':
        ctx.beginPath()
        if (item.shape === 'circle')
          ctx.arc(item.pos.x, item.pos.y, hs, 0, Math.PI * 2)
        else ctx.rect(item.pos.x - hs, item.pos.y - hs, hs * 2, hs * 2)
        ctx.fill()
        ctx.stroke()
        break
      case 'line':
        ctx.beginPath()
        ctx.moveTo(item.a.x, item.a.y)
        ctx.lineTo(item.b.x, item.b.y)
        ctx.stroke()
        break
      case 'polyline':
        ctx.beginPath()
        item.points.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
        )
        if (item.closed) ctx.closePath()
        if (item.ants) {
          ctx.save()
          ctx.strokeStyle = '#000000'
          ctx.stroke()
          ctx.strokeStyle = '#ffffff'
          ctx.setLineDash([hs, hs])
          ctx.stroke()
          ctx.restore()
        } else {
          ctx.stroke()
        }
        break
      case 'arc':
        ctx.beginPath()
        ctx.arc(item.center.x, item.center.y, item.radius, 0, Math.PI * 2)
        ctx.stroke()
        break
      case 'rect':
        if (item.ants) {
          ctx.save()
          ctx.strokeStyle = '#000000'
          ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
          ctx.strokeStyle = '#ffffff'
          ctx.setLineDash([hs, hs])
          ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
          ctx.restore()
        } else {
          ctx.strokeRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h)
        }
        break
      case 'preview':
        ctx.drawImage(
          item.canvas,
          item.rect.x,
          item.rect.y,
          item.rect.w,
          item.rect.h
        )
        break
    }
  }

  function selectedOutsideCanvasPreviewLayers(): OutsideCanvasPreviewLayer[] {
    const selectedIds = new Set(editor.selectedNodeIds())
    const previewLayers: OutsideCanvasPreviewLayer[] = []
    for (const node of editor.document().root.children) {
      if (!selectedIds.has(node.id) || node.kind !== 'raster' || !node.visible)
        continue
      const bitmap = content.get(node.contentId)?.canvas
      if (bitmap)
        previewLayers.push({
          bitmap,
          opacity: node.opacity,
          transform: node.transform
        })
    }
    return previewLayers
  }

  function drawOverlayCanvas(): void {
    if (!overlayCanvas || !viewportEl || !containerEl) return
    const dpr = window.devicePixelRatio || 1
    const bw = Math.max(1, Math.round(viewportEl.clientWidth * dpr))
    const bh = Math.max(1, Math.round(viewportEl.clientHeight * dpr))
    if (overlayCanvas.width !== bw) overlayCanvas.width = bw
    if (overlayCanvas.height !== bh) overlayCanvas.height = bh
    editor.buildOverlay()
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, bw, bh)
    const z = Math.max(0.01, panZoom.zoom())
    ctx.setTransform(
      z * dpr,
      0,
      0,
      z * dpr,
      containerEl.offsetLeft * dpr,
      containerEl.offsetTop * dpr
    )
    const { width, height } = editor.document()
    drawOutsideCanvasPreview(
      ctx,
      { w: width, h: height },
      selectedOutsideCanvasPreviewLayers()
    )
    ctx.lineWidth = 1 / z
    ctx.strokeStyle = '#3b82f6'
    ctx.fillStyle = '#ffffff'
    const hs = 4 / z
    for (const item of editor.overlay.items) drawItem(ctx, item, hs)
  }

  let disposed = false
  let rafId: number | null = null
  function requestRender(): void {
    if (disposed) return
    if (rafId == null)
      rafId = requestAnimationFrame(() => {
        rafId = null
        present()
        drawOverlayCanvas()
      })
  }
  let overlayRafId: number | null = null
  function requestOverlayRender(): void {
    if (disposed || rafId != null || overlayRafId != null) return
    overlayRafId = requestAnimationFrame(() => {
      overlayRafId = null
      drawOverlayCanvas()
    })
  }

  editor.setTool('transform')

  function setElements(els: LayerEditorElements): void {
    viewportEl = els.viewport
    containerEl = els.container
    mainCanvas = els.main
    overlayCanvas = els.overlay
    fitView()
  }

  function fitView(): void {
    panZoom.fit(editor.document().width, editor.document().height)
    requestRender()
  }

  function setZoom(ratio: number): void {
    panZoom.setZoom(ratio)
    requestRender()
  }

  function ensureBackgroundLayer(): void {
    if (editor.document().root.children[0]?.kind === 'fill') return
    editor.addNode(
      fillKind.create({
        name: 'Background',
        fill: { type: 'solid', color: DEFAULT_BACKGROUND_COLOR },
        opacity: 1,
        visible: false,
        locks: { content: true, position: true, visibility: false }
      }),
      0
    )
  }

  async function loadImages(urls: string[], names: string[]): Promise<number> {
    flipParity.clear()
    inputOrderIds.length = 0
    ensureBackgroundLayer()
    let failed = 0
    let docWidth = 0
    let docHeight = 0
    for (const [i, url] of urls.entries()) {
      let canvas: HTMLCanvasElement
      try {
        canvas = await loadImage(url)
      } catch (err) {
        console.warn('[LayerEditor] failed to load image', url, err)
        failed += 1
        continue
      }
      if (disposed) return failed
      docWidth = Math.max(docWidth, canvas.width)
      docHeight = Math.max(docHeight, canvas.height)
      const contentId = content.register(canvas, { uploadedUrl: url })
      const layer = rasterKind.create({
        name: names[i],
        contentId,
        url,
        naturalWidth: canvas.width,
        naturalHeight: canvas.height,
        transform: {
          x: 0,
          y: 0,
          w: canvas.width,
          h: canvas.height,
          rotation: 0
        }
      })
      editor.addNode(layer)
      inputOrderIds.push(layer.id)
    }
    if (docWidth > 0 && docHeight > 0) {
      const width = Math.min(docWidth, CANVAS_SIZE_MAX)
      const height = Math.min(docHeight, CANVAS_SIZE_MAX)
      const doc = editor.document()
      doc.width = width
      doc.height = height
      if (glOk.value) compositor.resize(width, height)
    }
    editor.history.clear()
    fitView()
    requestRender()
    return failed
  }

  function editProp<T>(
    label: string,
    dirty: number,
    get: () => T,
    set: (v: T) => void,
    value: T,
    mergeKey?: string
  ): void {
    const before = get()
    if (before === value) return
    set(value)
    editor.history.push(
      new PropCommand(label, dirty, get, set, before, value, mergeKey)
    )
    editor.invalidate()
  }

  function selectionTargets(id: string): string[] {
    const sel = editor.selectedNodeIds()
    return sel.length > 1 && sel.includes(id) ? sel : [id]
  }

  function batch(
    label: string,
    ids: string[],
    apply: (id: string) => void
  ): void {
    if (ids.length > 1) editor.history.beginGroup(label)
    for (const tid of ids) apply(tid)
    if (ids.length > 1) editor.history.endGroup()
  }

  function setOpacity(id: string, v: number): void {
    batch('Opacity', selectionTargets(id), (tid) => {
      const n = engineNode(tid)
      if (!n) return
      editProp(
        'Opacity',
        Dirty.META,
        () => n.opacity,
        (x) => (n.opacity = x),
        clamp(v, 0, 1),
        `opacity:${tid}`
      )
    })
  }

  function setBlendMode(id: string, v: BlendFn): void {
    batch('Blend', selectionTargets(id), (tid) => {
      const n = engineNode(tid)
      if (!n) return
      editProp(
        'Blend',
        Dirty.DRAWABLE,
        () => n.mode,
        (m) => (n.mode = m),
        defaultMode(Object.hasOwn(LAYER_MODES, v) ? v : 'normal'),
        `blend:${tid}`
      )
    })
  }

  function toggleVisible(id: string): void {
    const n = engineNode(id)
    if (!n) return
    editProp(
      'Visibility',
      Dirty.META,
      () => n.visible,
      (x) => (n.visible = x),
      !n.visible
    )
  }

  function renameLayer(id: string, name: string): void {
    const n = engineNode(id)
    if (!n) return
    editProp(
      'Rename',
      Dirty.META,
      () => n.name,
      (x) => (n.name = x),
      name.trim() || n.name
    )
  }

  function inputLayerIds(): string[] {
    return [...inputOrderIds]
  }

  function setLayerOrder(ids: string[]): void {
    const offset = backgroundLayer.value ? 1 : 0
    ids.forEach((id, index) => {
      editor.moveNodeTo(id, undefined, offset + index)
    })
  }

  function moveLayerTo(id: string, toIndex: number): void {
    const bg = backgroundLayer.value
    if (bg && (id === bg.id || toIndex < 1)) return
    editor.moveNodeTo(id, undefined, toIndex)
  }

  function moveLayer(id: string, dir: 1 | -1): void {
    const bg = backgroundLayer.value
    if (bg) {
      if (id === bg.id) return
      const index = editor
        .document()
        .root.children.findIndex((n) => n.id === id)
      if (dir === -1 && index !== -1 && index <= 1) return
    }
    editor.moveNode(id, dir)
  }

  function setActiveNode(id: string | null): void {
    editor.setActiveNode(id)
  }

  function setSelectedNodes(ids: string[]): void {
    editor.setSelectedNodes(ids)
  }

  function selectBackground(): void {
    const bg = backgroundLayer.value
    editor.setSelectedNodes(bg ? [bg.id] : [])
  }

  function setBackgroundColor(hex: string): void {
    const bg = backgroundNode()
    if (!bg || !HEX_COLOR_RE.test(hex)) return
    const color = hex.toLowerCase()
    if (bg.fill.type === 'solid' && bg.fill.color === color) return
    editProp<FillSpec>(
      'Background Color',
      Dirty.DRAWABLE,
      () => bg.fill,
      (v) => (bg.fill = v),
      { type: 'solid', color },
      `bg-color:${bg.id}`
    )
  }

  function setBackgroundOpacity(v: number): void {
    const bg = backgroundNode()
    if (!bg) return
    editProp(
      'Background Opacity',
      Dirty.META,
      () => bg.opacity,
      (x) => (bg.opacity = x),
      clamp(v, 0, 1),
      `bg-opacity:${bg.id}`
    )
  }

  function setBackgroundVisible(visible: boolean): void {
    const bg = backgroundNode()
    if (!bg) return
    editProp(
      'Background Visibility',
      Dirty.META,
      () => bg.visible,
      (x) => (bg.visible = x),
      visible
    )
  }

  function setPointerMode(mode: LayerEditorPointerMode): void {
    pointerMode.value = mode
  }

  function shiftLayers(nodes: SceneNode[], dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return
    for (const n of nodes) {
      if (n.kind === 'fill') continue
      n.transform = {
        ...n.transform,
        x: n.transform.x + dx,
        y: n.transform.y + dy
      }
      if (n.kind === 'group') shiftLayers(n.children, dx, dy)
    }
  }

  function setCanvasSize(w: number, h: number): void {
    const doc = editor.document()
    const width = clamp(Math.round(w), CANVAS_SIZE_MIN, CANVAS_SIZE_MAX)
    const height = clamp(Math.round(h), CANVAS_SIZE_MIN, CANVAS_SIZE_MAX)
    const before = { w: doc.width, h: doc.height }
    if (before.w === width && before.h === height) return
    const apply = (v: { w: number; h: number }): void => {
      const dx = Math.trunc((v.w - doc.width) / 2)
      const dy = Math.trunc((v.h - doc.height) / 2)
      doc.width = v.w
      doc.height = v.h
      if (glOk.value) compositor.resize(v.w, v.h)
      shiftLayers(doc.root.children, dx, dy)
      panZoom.setArtboardSize(v.w, v.h)
      panZoom.panBy(-dx * panZoom.zoom(), -dy * panZoom.zoom())
    }
    apply({ w: width, h: height })
    editor.history.push(
      new PropCommand(
        'Canvas Size',
        Dirty.STRUCTURE,
        () => ({ w: doc.width, h: doc.height }),
        apply,
        before,
        { w: width, h: height }
      )
    )
    editor.invalidate()
  }

  function pushLayerTransform(
    label: string,
    id: string,
    patch: Partial<Transform>
  ): void {
    const n = engineNode(id)
    if (!n || n.locks.position) return
    const before = { ...n.transform }
    const after = { ...before, ...patch }
    if (sameTransform(before, after)) return
    n.transform = after
    editor.history.push(new SetTransformCommand(label, n, before, after))
    editor.invalidate()
  }

  function setLayerPosition(id: string, x?: number, y?: number): void {
    const patch: Partial<Transform> = {}
    if (x !== undefined && Number.isFinite(x)) patch.x = x
    if (y !== undefined && Number.isFinite(y)) patch.y = y
    pushLayerTransform('Position', id, patch)
  }

  function setLayerDimensions(id: string, w?: number, h?: number): void {
    const patch: Partial<Transform> = {}
    if (w !== undefined && Number.isFinite(w)) patch.w = Math.max(1, w)
    if (h !== undefined && Number.isFinite(h)) patch.h = Math.max(1, h)
    pushLayerTransform('Dimensions', id, patch)
  }

  function setLayerRotationDeg(id: string, deg: number): void {
    if (!Number.isFinite(deg)) return
    pushLayerTransform('Rotation', id, { rotation: (deg * Math.PI) / 180 })
  }

  function alignLayer(id: string, op: LayerEditorAlignOp): void {
    const doc = editor.document()
    batch('Align', selectionTargets(id), (tid) => {
      const n = engineNode(tid)
      if (!n || n.locks.position) return
      const b = visualBounds(n.transform)
      switch (op) {
        case 'left':
          pushLayerTransform('Align', tid, { x: n.transform.x - b.x })
          break
        case 'centerH':
          pushLayerTransform('Align', tid, {
            x: n.transform.x + ((doc.width - b.w) / 2 - b.x)
          })
          break
        case 'right':
          pushLayerTransform('Align', tid, {
            x: n.transform.x + (doc.width - b.w - b.x)
          })
          break
        case 'top':
          pushLayerTransform('Align', tid, { y: n.transform.y - b.y })
          break
        case 'centerV':
          pushLayerTransform('Align', tid, {
            y: n.transform.y + ((doc.height - b.h) / 2 - b.y)
          })
          break
        case 'bottom':
          pushLayerTransform('Align', tid, {
            y: n.transform.y + (doc.height - b.h - b.y)
          })
          break
      }
    })
  }

  function flipLayer(id: string, axis: 'h' | 'v'): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'raster' || n.locks.content) return
    const entry = content.get(n.contentId)
    if (!entry) return
    const flipped = flipCanvasAxis(entry.canvas, axis)
    if (!flipped) return
    const before = snapshotRaster(n)
    n.contentId = content.register(flipped)
    n.url = undefined
    if (n.mask) {
      const maskEntry = content.get(n.mask.contentId)
      const flippedMask = maskEntry
        ? flipCanvasAxis(maskEntry.canvas, axis)
        : null
      if (flippedMask) {
        n.mask = {
          ...n.mask,
          contentId: content.register(flippedMask),
          url: undefined
        }
      }
    }
    const parityBefore = layerFlips(id)
    const parityAfter =
      axis === 'h'
        ? { ...parityBefore, h: !parityBefore.h }
        : { ...parityBefore, v: !parityBefore.v }
    const setParity = (p: { h: boolean; v: boolean }): void => {
      flipParity.set(id, p)
    }
    setParity(parityAfter)
    editor.history.beginGroup('Flip Layer')
    editor.history.push(
      new BakeRasterCommand('Flip Layer', n, before, snapshotRaster(n), content)
    )
    editor.history.push(
      new PropCommand(
        'Flip Layer',
        Dirty.META,
        () => layerFlips(id),
        setParity,
        parityBefore,
        parityAfter
      )
    )
    editor.history.endGroup()
    editor.invalidate()
  }

  function layerFlips(id: string): { h: boolean; v: boolean } {
    return flipParity.get(id) ?? { h: false, v: false }
  }

  function undo(): void {
    editor.undo()
  }

  function redo(): void {
    editor.redo()
  }

  function artboardPt(e: PointerEvent): { x: number; y: number } {
    return panZoom.screenToArtboard(e.clientX, e.clientY)
  }

  let panLast = { x: 0, y: 0 }
  let toolActive = false
  let pendingMoves: PointerEvent[] = []
  let moveRaf: number | null = null

  function capturePointer(zone: HTMLElement, e: PointerEvent): void {
    try {
      zone.setPointerCapture(e.pointerId)
    } catch {
      void 0
    }
  }

  function selectedTransformTargets(): SceneNode[] {
    const root = editor.document().root
    return filterTopmost(root, editor.selectedNodeIds())
      .map((id) => findNode(root, id)?.node ?? null)
      .filter((n): n is SceneNode => canTransformNode(n))
  }

  function selectionGizmo(): Transform | null {
    const targets = selectedTransformTargets()
    if (!targets.length) return null
    return targets.length === 1
      ? { ...targets[0].transform }
      : unionBounds(targets.map((n) => n.transform))
  }

  function resolvePointerTarget(e: PointerEvent, pt: Vec2): boolean {
    if (editor.floating()) return true
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    if (!additive) {
      const gizmo = selectionGizmo()
      const tol = 8 / Math.max(1e-3, panZoom.zoom())
      if (gizmo && hitHandle(gizmo, pt, tol)) return true
    }
    const picked = pickLayerAt(
      editor.document().root.children,
      pt,
      content,
      opts.alphaSampler
    )
    if (!picked) {
      if (!additive) editor.setSelectedNodes([])
      return false
    }
    const sel = editor.selectedNodeIds()
    if (additive) {
      editor.setSelectedNodes(
        sel.includes(picked.id)
          ? sel.filter((sid) => sid !== picked.id)
          : [...sel, picked.id]
      )
    } else if (!sel.includes(picked.id)) {
      editor.setSelectedNodes([picked.id])
    }
    return true
  }

  function onPointerDown(e: PointerEvent): void {
    const zone = viewportEl
    if (!zone) return
    zone.focus?.()
    pendingMoves = []
    if (
      e.button === 1 ||
      e.button === 2 ||
      (e.button === 0 && (spaceDown.value || pointerMode.value === 'hand'))
    ) {
      panning.value = true
      panLast = { x: e.offsetX, y: e.offsetY }
      capturePointer(zone, e)
      return
    }
    if (e.button !== 0) return
    if (!resolvePointerTarget(e, artboardPt(e))) return
    editor.pointerDown(e, artboardPt(e))
    toolActive = true
    capturePointer(zone, e)
  }

  function flushMove(): void {
    moveRaf = null
    const events = pendingMoves
    pendingMoves = []
    const e = events[events.length - 1]
    if (!e) return
    if (panning.value) {
      panZoom.panBy(e.offsetX - panLast.x, e.offsetY - panLast.y)
      panLast = { x: e.offsetX, y: e.offsetY }
      requestOverlayRender()
      return
    }
    if (toolActive) {
      editor.pointerMove(e, artboardPt(e))
    } else {
      hoverCursor.value = editor.cursorAt(artboardPt(e))
    }
  }

  function onPointerMove(e: PointerEvent): void {
    pendingMoves.push(e)
    if (moveRaf == null) moveRaf = requestAnimationFrame(flushMove)
  }

  function endToolGesture(e: PointerEvent): void {
    editor.pointerUp(e, artboardPt(e))
    editor.transformApply()
    toolActive = false
  }

  function onPointerUp(e: PointerEvent): void {
    if (moveRaf != null) {
      cancelAnimationFrame(moveRaf)
      flushMove()
    }
    if (panning.value) {
      panning.value = false
    } else if (toolActive) {
      endToolGesture(e)
    }
    try {
      viewportEl?.releasePointerCapture(e.pointerId)
    } catch {
      void 0
    }
  }

  function onPointerLeave(e: PointerEvent): void {
    if (toolActive) endToolGesture(e)
  }

  function onWheel(e: WheelEvent): void {
    panZoom.handleWheel(e)
    requestRender()
  }

  const viewportCursor = computed(() => {
    if (panning.value) return 'grabbing'
    if (spaceDown.value || pointerMode.value === 'hand') return 'grab'
    return hoverCursor.value
  })

  function onKeyDown(e: KeyboardEvent): void {
    if (isTextEditingTarget(e.target)) return
    const ctrl = e.ctrlKey || e.metaKey
    if (editor.floating()) {
      if (e.key === 'Enter') {
        e.preventDefault()
        editor.anchorFloating()
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      editor.transformApply()
      return
    }
    if (e.code === 'Space') {
      spaceDown.value = true
      e.preventDefault()
      return
    }
    if (ctrl && e.code === 'KeyZ') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (ctrl && e.code === 'KeyY') {
      e.preventDefault()
      redo()
      return
    }
    if (ctrl && e.code === 'KeyA') {
      e.preventDefault()
      editor.selectAll()
      return
    }
    if (ctrl && e.code === 'KeyD') {
      e.preventDefault()
      editor.selectNone()
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') spaceDown.value = false
  }

  function dispose(): void {
    disposed = true
    if (rafId != null) cancelAnimationFrame(rafId)
    if (overlayRafId != null) cancelAnimationFrame(overlayRafId)
    if (moveRaf != null) cancelAnimationFrame(moveRaf)
    rafId = null
    overlayRafId = null
    moveRaf = null
    compositor.dispose()
  }

  return {
    editor,
    content,
    compositor,
    panZoom,
    version,
    glOk,
    zoomRatio,
    layers,
    backgroundLayer,
    imageLayers,
    activeNodeId,
    activeNode,
    selectedNodeIds,
    selectedContext,
    canvasSize,
    canUndo,
    canRedo,
    pointerMode,
    viewportCursor,
    setElements,
    fitView,
    setZoom,
    requestRender,
    loadImages,
    setOpacity,
    setBlendMode,
    toggleVisible,
    renameLayer,
    moveLayer,
    moveLayerTo,
    setLayerOrder,
    inputLayerIds,
    setActiveNode,
    setSelectedNodes,
    selectBackground,
    setBackgroundColor,
    setBackgroundOpacity,
    setBackgroundVisible,
    setPointerMode,
    setCanvasSize,
    setLayerPosition,
    setLayerDimensions,
    setLayerRotationDeg,
    alignLayer,
    flipLayer,
    layerFlips,
    undo,
    redo,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onWheel,
    onKeyDown,
    onKeyUp,
    dispose
  }
}
