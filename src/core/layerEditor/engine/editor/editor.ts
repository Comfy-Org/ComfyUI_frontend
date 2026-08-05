import { BakeRasterCommand, snapshotRaster } from '../commands/bakeContent'
import { PropCommand } from '../commands/prop'
import { SetContentCommand } from '../commands/setContent'
import {
  AddNodeCommand,
  RemoveNodeCommand,
  ReorderCommand
} from '../commands/structure'
import type { Compositor, CompositeInput } from '../compositor'
import type { ContentStore } from '../content'
import type { DocGuide, Document, NodeLocation } from '../document'
import { filterTopmost, findNode } from '../document'
import { CommandGroup, Dirty, History } from '../history'
import type { Command } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { defaultMode, resolveMode } from '../mode'
import type {
  ChannelData,
  GroupData,
  RasterData,
  Rect,
  SceneNode,
  Transform,
  Vec2
} from '../node'
import { getNodeKind } from '../nodeKind'
import type { BrushParams } from '../paint'
import { getPaintCore } from '../paint'
import {
  bakeMaskInto,
  bakePlaced,
  drawPlacedInto,
  isIdentityPlacement,
  placedBounds
} from '../render/bake'
import { placeBitmap } from '../render/place'
import type { PlacedEntry, PreviewOverride } from '../render/renderStack'
import { renderDocument } from '../render/renderStack'
import type { Tool, ToolContext } from '../tool'
import { getTool } from '../tool'
import { addTransformBox } from '../tools/overlayBox'
import type { HandleId } from '../tools/transformMath'
import {
  angleTo,
  applyMove,
  applyResize,
  applyRotate,
  hitHandle,
  insideBox
} from '../tools/transformMath'
import { groupKind } from '../kinds/group'
import { isTransformTool } from '../tools/transformTool'
import type { ArrangeOp } from './arrangeOps'
import { arrangeNodes } from './arrangeOps'
import type { GuideDragEnd } from './guideOps'
import {
  guideAddLive,
  guideEndDrag,
  guideMoveLive,
  sanitizeGuides
} from './guideOps'
import { SetSelectionCommand, snapshotSelection } from '../commands/selection'
import { generateId } from '../id'

import {
  canRasterizeLayer,
  cropToContent as cropToContentOp,
  layerToCanvasSize as layerToCanvasSizeOp,
  mergeDown as mergeDownOp,
  rasterizeLayer as rasterizeLayerOp
} from './layerOps'
import {
  clampRectToDoc,
  fullSelectionCanvas,
  invertSelectionCanvas,
  lumaBBox,
  rectSelectionCanvas
} from './selectionOps'
import type { GrayMask, SelectionOp } from './selectionMath'
import {
  borderMask,
  combineMasks,
  emptyMask,
  featherMask,
  growMask,
  maskBoundary,
  maskBounds,
  maskFromCanvas,
  maskToCanvas,
  shrinkMask
} from './selectionMath'
import { OverlayList } from './overlayList'

export interface FloatingItem {
  contentId: string
  transform: Transform
  name?: string
  url?: string
}

type FloatSession =
  | { mode: 'idle' }
  | { mode: 'move'; start: Vec2; before: Transform }
  | { mode: 'resize'; handle: HandleId; before: Transform }
  | { mode: 'rotate'; before: Transform; grab: number }

export interface EditorOptions {
  compositor: Compositor
  content?: ContentStore
  onChange?: () => void
}

const DEFAULT_BRUSH: BrushParams = {
  size: 24,
  hardness: 0.6,
  spacing: 0.1,
  opacity: 1,
  flow: 1,
  color: '#ffffff'
}

export function emptyDocument(width: number, height: number): Document {
  const root: GroupData = {
    kind: 'group',
    id: 'root',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: width, h: height, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children: [],
    passThrough: false
  }
  return { version: 2, width, height, root, channels: [] }
}

export interface Editor {
  readonly history: History
  readonly content: ContentStore
  readonly overlay: OverlayList
  document(): Document
  loadDocument(doc: Document): void
  serialize(): unknown
  loadJSON(raw: unknown): void
  hydrate(loadUrl: (url: string) => Promise<HTMLCanvasElement>): Promise<void>
  setTool(id: string): void
  activeToolId(): string
  setBrush(params: Partial<BrushParams>): void
  brushParams(): BrushParams
  modifySelection(
    kind: 'feather' | 'grow' | 'shrink' | 'border',
    radius: number
  ): boolean
  transformApply(): boolean
  transformCancel(): boolean
  transformDirty(): boolean
  arrangeSelected(op: ArrangeOp): boolean
  setSnapGrid(size: number): void
  snapGrid(): number
  guides(): DocGuide[]
  guideAddLive(axis: 'x' | 'y', pos: number): number
  guideMoveLive(index: number, pos: number): void
  guideEndDrag(index: number, end: GuideDragEnd): void
  activeNodeId(): string | null
  setActiveNode(id: string | null): void
  selectedNodeIds(): string[]
  setSelectedNodes(ids: string[]): void
  removeNodes(ids: string[]): boolean
  pointerDown(e: PointerEvent, pt: Vec2): void
  pointerMove(e: PointerEvent, pt: Vec2): void
  pointerUp(e: PointerEvent, pt: Vec2): void
  hover(e: PointerEvent, pt: Vec2): void
  cursorAt(pt: Vec2): string
  addNode(node: SceneNode, index?: number, parentId?: string): void
  removeActive(): void
  reorder(id: string, toIndex: number): void
  moveNode(id: string, dir: 1 | -1): boolean
  moveNodeTo(id: string, parentId: string | undefined, toIndex: number): boolean
  groupActive(): boolean
  ungroupActive(): boolean
  setZoom(z: number): void
  zoom(): number
  render(region?: Rect | null): void
  takePresentDamage(): { full: boolean; rect: Rect | null }
  buildOverlay(): void
  invalidate(): void
  undo(): void
  redo(): void
  floating(): FloatingItem | null
  startFloating(
    contentId: string,
    width: number,
    height: number,
    name?: string
  ): void
  anchorFloating(target?: 'active' | 'new'): void
  cancelFloating(): void
  mergeDown(id: string): boolean
  rasterizeLayer(id: string): boolean
  canRasterize(id: string): boolean
  flattenImage(bgColor?: string): boolean
  flipImage(axis: 'h' | 'v'): boolean
  cropToContent(id: string): boolean
  layerToCanvasSize(id: string): boolean
  selectionBounds(): Rect | null
  setRectSelection(rect: Rect): boolean
  selectAll(): boolean
  selectNone(): boolean
  invertSelection(): boolean
  maskToSelection(id: string): boolean
  paintPreview(key: string): HTMLCanvasElement | null
  setPaintPreview(key: string, canvas: HTMLCanvasElement | null): void
}

export function createEditor(opts: EditorOptions): Editor {
  const compositor = opts.compositor
  const content = opts.content ?? new DefaultContentStore()
  const history = new History()
  const notify = opts.onChange ?? (() => {})
  const overlay = new OverlayList(() => notify())

  let doc = emptyDocument(1024, 1024)
  let toolId = 'select'
  let tool: Tool | null = null
  let selectedIds: string[] = []
  let zoomLevel = 1
  let snapGridSize = 0
  let brush: BrushParams = { ...DEFAULT_BRUSH }

  const overrides = new Map<string, PreviewOverride>()
  const placedCache = new Map<string, PlacedEntry>()
  let previewVersion = 0
  let pendingDamage: Rect | null = null
  let presentFull = true
  let presentRect: Rect | null = null

  function setPreviewOverride(
    key: string,
    canvas: HTMLCanvasElement | null,
    rects?: Rect[] | Rect | null
  ): void {
    if (!canvas) {
      overrides.delete(key)
      pendingDamage = null
      return
    }
    const list = !rects
      ? null
      : Array.isArray(rects)
        ? rects.length
          ? rects
          : null
        : [rects]
    overrides.set(key, { canvas, version: ++previewVersion, rects: list })
    if (list) {
      let u = pendingDamage
      for (const r of list) u = u ? unionRects(u, r) : r
      pendingDamage = u
    } else {
      pendingDamage = null
    }
  }

  function unionRects(a: Rect, b: Rect): Rect {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
      x,
      y,
      w: Math.max(a.x + a.w, b.x + b.w) - x,
      h: Math.max(a.y + a.h, b.y + b.h) - y
    }
  }
  let floating: FloatingItem | null = null
  let floatSession: FloatSession = { mode: 'idle' }

  function floatingInputs(): CompositeInput[] {
    if (!floating) return []
    const entry = content.get(floating.contentId)
    if (!entry) return []
    const canvas = placeBitmap(
      entry.canvas,
      floating.transform,
      doc.width,
      doc.height
    )
    if (!canvas) return []
    return [
      {
        texture: {
          source: canvas,
          rect: { x: 0, y: 0, w: doc.width, h: doc.height },
          linear: false
        },
        opacity: 1,
        mode: resolveMode(defaultMode('normal'))
      }
    ]
  }
  function render(region?: Rect | null): void {
    renderDocument(
      doc,
      { content, compositor, devicePixelRatio: 1, overrides, placedCache },
      floatingInputs(),
      region
    )
  }
  function selectionChannel(): ChannelData | null {
    if (!doc.selectionId) return null
    return (
      doc.channels.find(
        (ch) => ch.id === doc.selectionId && ch.role === 'selection'
      ) ?? null
    )
  }

  let selOutlineCache: { key: string; outlines: Vec2[][] } | null = null
  function selectionOutlines(sel: ChannelData): Vec2[][] {
    if (selOutlineCache?.key === sel.contentId) return selOutlineCache.outlines
    const entry = content.get(sel.contentId)
    const mask = entry ? maskFromCanvas(entry.canvas) : null
    const outlines = mask ? maskBoundary(mask) : []
    selOutlineCache = { key: sel.contentId, outlines }
    return outlines
  }

  function buildOverlay(): void {
    overlay.clear()
    for (const g of doc.guides ?? []) {
      if (g.axis === 'x') {
        overlay.add({
          type: 'line',
          a: { x: g.pos, y: 0 },
          b: { x: g.pos, y: doc.height }
        })
      } else {
        overlay.add({
          type: 'line',
          a: { x: 0, y: g.pos },
          b: { x: doc.width, y: g.pos }
        })
      }
    }
    const sel = selectionChannel()
    if (sel?.bounds) {
      const outlines = selectionOutlines(sel)
      if (outlines.length) {
        for (const points of outlines)
          overlay.add({ type: 'polyline', points, closed: true, ants: true })
      } else {
        overlay.add({ type: 'rect', rect: sel.bounds, ants: true })
      }
    }
    if (floating) {
      addTransformBox(overlay, floating.transform)
      return
    }
    tool?.drawOverlay(overlay)
  }
  function refresh(): void {
    const region = pendingDamage
    pendingDamage = null
    if (region) {
      if (!presentFull)
        presentRect = presentRect ? unionRects(presentRect, region) : region
    } else {
      presentFull = true
      presentRect = null
    }
    render(region)
    buildOverlay()
    notify()
  }
  function liveSelectedIds(): string[] {
    return selectedIds.filter((id) => findNode(doc.root, id))
  }
  function activeNodeIdOf(): string | null {
    for (let i = selectedIds.length - 1; i >= 0; i--) {
      if (findNode(doc.root, selectedIds[i])) return selectedIds[i]
    }
    return null
  }
  function setSelected(ids: string[]): void {
    const seen = new Set<string>()
    const next: string[] = []
    for (const id of ids) {
      if (seen.has(id) || !findNode(doc.root, id)) continue
      seen.add(id)
      next.push(id)
    }
    if (
      next.length === selectedIds.length &&
      next.every((id, i) => id === selectedIds[i])
    )
      return
    selectedIds = next
    buildOverlay()
    notify()
  }
  function setActive(id: string | null): void {
    setSelected(id ? [id] : [])
  }
  function collectGarbage(): void {
    const live = new Set<string>()
    for (const id of getNodeKind(doc.root.kind).contentIds(doc.root))
      live.add(id)
    for (const ch of doc.channels) live.add(ch.contentId)
    for (const id of history.contentRefs()) live.add(id)
    if (floating) live.add(floating.contentId)
    content.collectGarbage(live)
  }
  history.onChange(collectGarbage)

  const ctx: ToolContext = {
    document: () => doc,
    history,
    compositor,
    content,
    overlay,
    activeNodeId: activeNodeIdOf,
    setActiveNode: setActive,
    selectedNodeIds: liveSelectedIds,
    setSelectedNodes: setSelected,
    createPaintCore: (id) => getPaintCore(id).create(),
    setPaintPreview: (key, canvas, rect) => {
      setPreviewOverride(key, canvas, rect)
    },
    selection: {
      combineShape: (label, mask, op) => {
        combineSelectionMask(label, mask, op)
      },
      currentMask: currentSelectionMask,
      none: () => {
        commitSelection('Select None', null, null)
      }
    },
    floatSelection: () => false,
    compositePixels: () => {
      render()
      const img = compositor.readback()
      if (img.width !== doc.width || img.height !== doc.height) return null
      return img
    },
    zoom: () => zoomLevel,
    snapGrid: () => snapGridSize,
    requestRender: refresh,
    options: <T>() => brush as unknown as T
  }

  function makeTool(): void {
    tool?.onDeactivate?.()
    tool = getTool(toolId).create(ctx)
    tool.onActivate?.()
  }
  makeTool()

  function activeLocation(): {
    parent: GroupData
    node: SceneNode
    index: number
  } | null {
    const id = activeNodeIdOf()
    if (!id) return null
    return findNode(doc.root, id)
  }

  function arrangeSelectedImpl(op: ArrangeOp): boolean {
    if (isTransformTool(tool)) tool.apply()
    const ok = arrangeNodes(doc.root, liveSelectedIds(), op, history)
    if (ok) refresh()
    return ok
  }

  function removeNodesImpl(ids: string[]): boolean {
    const locs = filterTopmost(doc.root, ids)
      .map((id) => findNode(doc.root, id))
      .filter((l): l is NodeLocation => l !== null)
    if (!locs.length) return false
    const cmds = new CommandGroup(`Delete ${locs.length} Layers`)
    for (const loc of locs) {
      const at = loc.parent.children.indexOf(loc.node)
      if (at < 0) continue
      loc.parent.children.splice(at, 1)
      cmds.children.push(
        new RemoveNodeCommand(
          `Delete ${loc.node.name}`,
          loc.parent,
          loc.node,
          at
        )
      )
    }
    if (cmds.empty) return false
    history.push(cmds.children.length === 1 ? cmds.children[0] : cmds)
    selectedIds = []
    refresh()
    return true
  }

  function groupNodesImpl(ids: string[]): boolean {
    const locs = filterTopmost(doc.root, ids)
      .filter((id) => id !== doc.root.id)
      .map((id) => findNode(doc.root, id))
      .filter((l): l is NodeLocation => l !== null)
    if (!locs.length) return false
    const sameParent = locs.every((l) => l.parent === locs[0].parent)
    const insertParent = sameParent ? locs[0].parent : doc.root
    const insertAt = sameParent
      ? Math.min(...locs.map((l) => l.parent.children.indexOf(l.node)))
      : doc.root.children.length
    const cmds = new CommandGroup('Group')
    for (const loc of locs) {
      const at = loc.parent.children.indexOf(loc.node)
      loc.parent.children.splice(at, 1)
      cmds.children.push(
        new RemoveNodeCommand(
          `Group ${loc.node.name}`,
          loc.parent,
          loc.node,
          at
        )
      )
    }
    const group = groupKind.create({ children: locs.map((l) => l.node) })
    const at = Math.max(0, Math.min(insertAt, insertParent.children.length))
    insertParent.children.splice(at, 0, group)
    cmds.children.push(
      new AddNodeCommand(`Add ${group.name}`, insertParent, group, at)
    )
    history.push(cmds)
    selectedIds = [group.id]
    refresh()
    return true
  }

  function activeRaster(): RasterData | null {
    const loc = activeLocation()
    return loc && loc.node.kind === 'raster' ? (loc.node as RasterData) : null
  }

  function currentSelectionMask(): GrayMask | null {
    const sel = selectionChannel()
    if (!sel) return null
    const entry = content.get(sel.contentId)
    if (!entry) return null
    return maskFromCanvas(entry.canvas)
  }

  function combineSelectionMask(
    label: string,
    shapeMask: GrayMask,
    op: SelectionOp
  ): boolean {
    let result = shapeMask
    if (op !== 'replace') {
      const base = currentSelectionMask() ?? emptyMask(doc.width, doc.height)
      result = combineMasks(base, shapeMask, op)
    }
    const bounds = maskBounds(result)
    if (!bounds) return commitSelection(label, null, null)
    const canvas = maskToCanvas(result)
    if (!canvas) return false
    return commitSelection(label, canvas, bounds)
  }

  function commitSelection(
    label: string,
    canvas: HTMLCanvasElement | null,
    bounds: Rect | null
  ): boolean {
    const before = snapshotSelection(doc)
    doc.channels = doc.channels.filter((ch) => ch.role !== 'selection')
    if (canvas && bounds) {
      const channel: ChannelData = {
        id: generateId('sel'),
        role: 'selection',
        contentId: content.register(canvas),
        enabled: true,
        bounds
      }
      doc.channels.push(channel)
      doc.selectionId = channel.id
    } else {
      doc.selectionId = undefined
      if (!before.channel) return false
    }
    history.push(
      new SetSelectionCommand(
        label,
        doc,
        before,
        snapshotSelection(doc),
        content
      )
    )
    refresh()
    return true
  }

  function layerOpDeps() {
    return {
      root: doc.root,
      content,
      push: (cmd: Command) => history.push(cmd),
      bitmapOf: (node: SceneNode): HTMLCanvasElement | null => {
        if (node.kind === 'raster')
          return content.get((node as RasterData).contentId)?.canvas ?? null
        return null
      }
    }
  }

  function addNodeInternal(
    node: SceneNode,
    index?: number,
    parent?: GroupData
  ): void {
    const into = parent ?? doc.root
    const at = index ?? into.children.length
    into.children.splice(at, 0, node)
    history.push(new AddNodeCommand(`Add ${node.name}`, into, node, at))
    selectedIds = [node.id]
    refresh()
  }

  function anchorInto(
    node: RasterData,
    item: FloatingItem,
    floatCanvas: HTMLCanvasElement
  ): boolean {
    const targetEntry = content.get(node.contentId)
    if (!targetEntry) return false
    const fb = placedBounds(item.transform)
    const tb = placedBounds(node.transform)
    const ux = Math.min(tb.x, fb.x)
    const uy = Math.min(tb.y, fb.y)
    const uw = Math.max(tb.x + tb.w, fb.x + fb.w) - ux
    const uh = Math.max(tb.y + tb.h, fb.y + fb.h) - uy
    if (uw > 16384 || uh > 16384) return false
    const oldTransform = { ...node.transform }
    const canvas = document.createElement('canvas')
    canvas.width = uw
    canvas.height = uh
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    drawPlacedInto(ctx, targetEntry.canvas, node.transform, ux, uy)
    drawPlacedInto(ctx, floatCanvas, item.transform, ux, uy)
    const before = snapshotRaster(node)
    node.contentId = content.register(canvas)
    node.url = undefined
    node.naturalWidth = uw
    node.naturalHeight = uh
    node.transform = { x: ux, y: uy, w: uw, h: uh, rotation: 0 }
    if (node.mask) {
      const maskEntry = content.get(node.mask.contentId)
      const bakedMask = maskEntry
        ? bakeMaskInto(
            maskEntry.canvas,
            oldTransform,
            { x: ux, y: uy, w: uw, h: uh },
            'white'
          )
        : null
      if (bakedMask) {
        node.mask = {
          ...node.mask,
          contentId: content.register(bakedMask),
          url: undefined
        }
      }
    }
    history.push(
      new BakeRasterCommand(
        'Anchor',
        node,
        before,
        snapshotRaster(node),
        content
      )
    )
    return true
  }

  function anchorAsNewLayer(
    item: FloatingItem,
    entry: {
      canvas: HTMLCanvasElement
      width: number
      height: number
      uploadedUrl: string | null
    }
  ): void {
    const kind = getNodeKind('raster')
    if (isIdentityPlacement(item.transform, entry.width, entry.height)) {
      addNodeInternal(
        kind.create({
          name: item.name ?? 'Layer',
          contentId: item.contentId,
          url: entry.uploadedUrl ?? undefined,
          naturalWidth: entry.width,
          naturalHeight: entry.height,
          transform: { ...item.transform }
        } as Partial<RasterData>) as SceneNode
      )
      return
    }
    const baked = bakePlaced(entry.canvas, item.transform)
    if (!baked) {
      addNodeInternal(
        kind.create({
          name: item.name ?? 'Layer',
          contentId: item.contentId,
          url: entry.uploadedUrl ?? undefined,
          naturalWidth: entry.width,
          naturalHeight: entry.height,
          transform: { ...item.transform }
        } as Partial<RasterData>) as SceneNode
      )
      return
    }
    const cid = content.register(baked.canvas)
    addNodeInternal(
      kind.create({
        name: item.name ?? 'Layer',
        contentId: cid,
        naturalWidth: baked.bounds.w,
        naturalHeight: baked.bounds.h,
        transform: {
          x: baked.bounds.x,
          y: baked.bounds.y,
          w: baked.bounds.w,
          h: baked.bounds.h,
          rotation: 0
        }
      } as Partial<RasterData>) as SceneNode
    )
  }

  function anchorFloatingImpl(target?: 'active' | 'new'): void {
    if (!floating) return
    const item = floating
    const entry = content.get(item.contentId)
    if (!entry) {
      floating = null
      floatSession = { mode: 'idle' }
      refresh()
      return
    }
    const mode: 'active' | 'new' = target ?? (activeRaster() ? 'active' : 'new')
    if (mode === 'active') {
      const node = activeRaster()
      if (node && !node.locks.content && anchorInto(node, item, entry.canvas)) {
        floating = null
        floatSession = { mode: 'idle' }
        refresh()
        return
      }
    }
    floating = null
    floatSession = { mode: 'idle' }
    anchorAsNewLayer(item, entry)
  }

  function floatingPress(pt: Vec2): void {
    if (!floating) return
    const t = floating.transform
    const tol = 8 / Math.max(1e-3, zoomLevel)
    const h = hitHandle(t, pt, tol)
    if (h === 'rotate') {
      floatSession = { mode: 'rotate', before: { ...t }, grab: angleTo(t, pt) }
      return
    }
    if (h) {
      floatSession = { mode: 'resize', handle: h, before: { ...t } }
      return
    }
    if (insideBox(t, pt)) {
      floatSession = { mode: 'move', start: pt, before: { ...t } }
      return
    }
    anchorFloatingImpl()
  }

  function floatingMotion(e: PointerEvent, pt: Vec2): void {
    if (!floating || floatSession.mode === 'idle') return
    const s = floatSession
    if (s.mode === 'move') {
      floating.transform = applyMove(
        s.before,
        pt.x - s.start.x,
        pt.y - s.start.y
      )
    } else if (s.mode === 'resize') {
      floating.transform = applyResize(s.before, s.handle, pt, 1, e.shiftKey)
    } else {
      floating.transform = applyRotate(
        s.before,
        s.before.rotation,
        s.grab,
        pt,
        e.shiftKey ? Math.PI / 12 : 0
      )
    }
    refresh()
  }

  return {
    history,
    content,
    overlay,
    document: () => doc,
    loadDocument(d) {
      doc = d
      selectedIds = []
      floating = null
      floatSession = { mode: 'idle' }
      history.clear()
      refresh()
    },
    serialize() {
      return {
        version: doc.version,
        width: doc.width,
        height: doc.height,
        root: getNodeKind(doc.root.kind).serialize(doc.root),
        channels: doc.channels,
        selectionId: doc.selectionId,
        guides: doc.guides?.length
          ? doc.guides.map((g) => ({ ...g }))
          : undefined,
        floating: floating
          ? {
              contentId: floating.contentId,
              url: content.get(floating.contentId)?.uploadedUrl ?? undefined,
              transform: { ...floating.transform },
              name: floating.name
            }
          : undefined
      }
    },
    loadJSON(raw) {
      let obj: unknown
      try {
        obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        return
      }
      if (!obj || typeof obj !== 'object') return
      const o = obj as Record<string, unknown>
      const rootRaw = (o.root as unknown) ?? obj
      const root = getNodeKind('group').normalize(rootRaw) as GroupData
      const w = Number(o.width) || doc.width
      const h = Number(o.height) || doc.height
      const loadedGuides = sanitizeGuides(o.guides, w, h)
      doc = {
        version: 2,
        width: w,
        height: h,
        root,
        channels: Array.isArray(o.channels)
          ? (o.channels as Document['channels'])
          : [],
        selectionId:
          typeof o.selectionId === 'string' ? o.selectionId : undefined,
        guides: loadedGuides.length ? loadedGuides : undefined
      }
      selectedIds = []
      floating = null
      floatSession = { mode: 'idle' }
      const rawFloat = o.floating as
        | {
            contentId?: unknown
            url?: unknown
            transform?: unknown
            name?: unknown
          }
        | undefined
      if (
        rawFloat &&
        typeof rawFloat.contentId === 'string' &&
        rawFloat.transform &&
        typeof rawFloat.transform === 'object'
      ) {
        const t = rawFloat.transform as Record<string, unknown>
        const num = (v: unknown, d: number): number =>
          typeof v === 'number' && isFinite(v) ? v : d
        floating = {
          contentId: rawFloat.contentId,
          url: typeof rawFloat.url === 'string' ? rawFloat.url : undefined,
          name: typeof rawFloat.name === 'string' ? rawFloat.name : undefined,
          transform: {
            x: num(t.x, 0),
            y: num(t.y, 0),
            w: num(t.w, 1),
            h: num(t.h, 1),
            rotation: num(t.rotation, 0)
          }
        }
      }
      history.clear()
      refresh()
    },
    async hydrate(loadUrl) {
      await getNodeKind(doc.root.kind).hydrate(doc.root, { content, loadUrl })
      if (floating && floating.url && !content.has(floating.contentId)) {
        try {
          const canvas = await loadUrl(floating.url)
          content.register(canvas, {
            id: floating.contentId,
            uploadedUrl: floating.url
          })
        } catch {
          void 0
        }
      }
      for (const ch of doc.channels) {
        if (ch.url && !content.has(ch.contentId)) {
          try {
            const canvas = await loadUrl(ch.url)
            content.register(canvas, { id: ch.contentId, uploadedUrl: ch.url })
          } catch {
            void 0
          }
        }
      }
      refresh()
    },
    setTool(id) {
      toolId = id
      makeTool()
      buildOverlay()
      notify()
    },
    activeToolId: () => toolId,
    setBrush(params) {
      brush = { ...brush, ...params }
    },
    brushParams: () => ({ ...brush }),
    modifySelection(kind, radius) {
      const mask = currentSelectionMask()
      if (!mask) return false
      const r = Math.max(1, Math.round(radius))
      const selBounds = selectionChannel()?.bounds ?? null
      const next =
        kind === 'feather'
          ? featherMask(mask, r, selBounds)
          : kind === 'grow'
            ? growMask(mask, r, selBounds)
            : kind === 'shrink'
              ? shrinkMask(mask, r, selBounds)
              : borderMask(mask, r, selBounds)
      const bounds = maskBounds(next)
      if (!bounds) return commitSelection('Select None', null, null)
      const canvas = maskToCanvas(next)
      if (!canvas) return false
      const labels = {
        feather: 'Feather Selection',
        grow: 'Grow Selection',
        shrink: 'Shrink Selection',
        border: 'Border Selection'
      }
      return commitSelection(labels[kind], canvas, bounds)
    },
    transformApply: () => (isTransformTool(tool) ? tool.apply() : false),
    transformCancel: () => (isTransformTool(tool) ? tool.cancel() : false),
    transformDirty: () => (isTransformTool(tool) ? tool.isDirty() : false),
    arrangeSelected: arrangeSelectedImpl,
    activeNodeId: activeNodeIdOf,
    setActiveNode: setActive,
    selectedNodeIds: liveSelectedIds,
    setSelectedNodes: setSelected,
    removeNodes: removeNodesImpl,
    pointerDown(e, pt) {
      if (floating) {
        floatingPress(pt)
        return
      }
      tool?.onButtonPress(e, pt)
    },
    pointerMove(e, pt) {
      if (floating) {
        floatingMotion(e, pt)
        return
      }
      tool?.onMotion(e, pt)
    },
    pointerUp(e, pt) {
      if (floating) {
        floatSession = { mode: 'idle' }
        return
      }
      tool?.onButtonRelease(e, pt)
    },
    hover(e, pt) {
      if (floating) return
      tool?.onHover(e, pt)
    },
    cursorAt(pt) {
      if (floating) return 'default'
      return tool?.cursorFor(pt) ?? 'default'
    },
    addNode(node, index, parentId) {
      const parent =
        parentId && parentId !== doc.root.id
          ? (findNode(doc.root, parentId)?.node as GroupData | undefined)
          : undefined
      addNodeInternal(
        node,
        index,
        parent && parent.kind === 'group' ? parent : undefined
      )
    },
    removeActive() {
      const id = activeNodeIdOf()
      if (id) removeNodesImpl([id])
    },
    reorder(id, toIndex) {
      const loc = findNode(doc.root, id)
      if (!loc) return
      loc.parent.children.splice(loc.index, 1)
      const to = Math.max(0, Math.min(toIndex, loc.parent.children.length))
      loc.parent.children.splice(to, 0, loc.node)
      history.push(
        new ReorderCommand(
          'Reorder',
          loc.node,
          loc.parent,
          loc.index,
          loc.parent,
          to
        )
      )
      refresh()
    },
    moveNode(id, dir) {
      const loc = findNode(doc.root, id)
      if (!loc) return false
      const { parent, node, index } = loc
      const sib = parent.children[index + dir]
      let toParent: GroupData
      let toIndex: number
      if (sib && sib.kind === 'group') {
        toParent = sib as GroupData
        toIndex = dir === 1 ? 0 : toParent.children.length
      } else if (sib) {
        toParent = parent
        toIndex = index + dir
      } else if (parent !== doc.root) {
        const ploc = findNode(doc.root, parent.id)
        if (!ploc) return false
        toParent = ploc.parent
        toIndex = dir === 1 ? ploc.index + 1 : ploc.index
      } else {
        return false
      }
      parent.children.splice(index, 1)
      const to = Math.max(0, Math.min(toIndex, toParent.children.length))
      toParent.children.splice(to, 0, node)
      history.push(
        new ReorderCommand('Reorder', node, parent, index, toParent, to)
      )
      refresh()
      return true
    },
    moveNodeTo(id, parentId, toIndex) {
      const loc = findNode(doc.root, id)
      if (!loc) return false
      const target =
        parentId && parentId !== doc.root.id
          ? findNode(doc.root, parentId)?.node
          : doc.root
      if (!target || target.kind !== 'group') return false
      const toParent = target as GroupData
      if (loc.node.kind === 'group') {
        if (toParent.id === loc.node.id) return false
        if (findNode(loc.node as GroupData, toParent.id)) return false
      }
      let to = Math.max(0, Math.min(toIndex, toParent.children.length))
      loc.parent.children.splice(loc.index, 1)
      if (toParent === loc.parent && loc.index < to) to -= 1
      to = Math.max(0, Math.min(to, toParent.children.length))
      if (toParent === loc.parent && to === loc.index) {
        loc.parent.children.splice(loc.index, 0, loc.node)
        return false
      }
      toParent.children.splice(to, 0, loc.node)
      history.push(
        new ReorderCommand(
          'Reorder',
          loc.node,
          loc.parent,
          loc.index,
          toParent,
          to
        )
      )
      refresh()
      return true
    },
    groupActive() {
      return groupNodesImpl(selectedIds)
    },
    ungroupActive() {
      const loc = activeLocation()
      if (!loc || loc.node.kind !== 'group') return false
      const group = loc.node as GroupData
      const kids = [...group.children]
      loc.parent.children.splice(loc.index, 1, ...kids)
      const cmds = new CommandGroup('Ungroup')
      cmds.children.push(
        new RemoveNodeCommand(
          `Ungroup ${group.name}`,
          loc.parent,
          group,
          loc.index
        )
      )
      kids.forEach((k, i) =>
        cmds.children.push(
          new AddNodeCommand(`Add ${k.name}`, loc.parent, k, loc.index + i)
        )
      )
      history.push(cmds)
      selectedIds = kids.map((k) => k.id)
      refresh()
      return true
    },
    setZoom(z) {
      zoomLevel = z
    },
    zoom: () => zoomLevel,
    setSnapGrid(size: number) {
      snapGridSize = Math.max(0, size || 0)
      refresh()
    },
    snapGrid: () => snapGridSize,
    guides: () => (doc.guides ?? []).map((g) => ({ ...g })),
    guideAddLive(axis, pos) {
      const idx = guideAddLive(doc, axis, pos)
      buildOverlay()
      notify()
      return idx
    },
    guideMoveLive(index, pos) {
      guideMoveLive(doc, index, pos)
      buildOverlay()
      notify()
    },
    guideEndDrag(index, end) {
      guideEndDrag(doc, history, index, end)
      refresh()
    },
    render,
    takePresentDamage() {
      const dmg = { full: presentFull, rect: presentRect }
      presentFull = false
      presentRect = null
      return dmg
    },
    buildOverlay,
    invalidate: refresh,
    undo() {
      history.undo()
      refresh()
    },
    redo() {
      history.redo()
      refresh()
    },
    mergeDown(id) {
      const ok = mergeDownOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    rasterizeLayer(id) {
      const ok = rasterizeLayerOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    canRasterize(id) {
      return canRasterizeLayer(doc.root, id)
    },
    flattenImage(bgColor?: string) {
      if (!compositor.getCanvas()) return false
      if (floating) anchorFloatingImpl()
      if (doc.root.children.length === 0) return false
      render()
      const img = compositor.readback()
      if (img.width !== doc.width || img.height !== doc.height) return false
      const canvas = document.createElement('canvas')
      canvas.width = doc.width
      canvas.height = doc.height
      const g = canvas.getContext('2d')
      if (!g) return false
      g.fillStyle =
        bgColor && /^#[0-9a-f]{6}$/i.test(bgColor) ? bgColor : '#ffffff'
      g.fillRect(0, 0, doc.width, doc.height)
      const tmp = document.createElement('canvas')
      tmp.width = doc.width
      tmp.height = doc.height
      const tg = tmp.getContext('2d')
      if (!tg) return false
      tg.putImageData(img, 0, 0)
      g.drawImage(tmp, 0, 0)

      const group = new CommandGroup('Flatten Image')
      const children = doc.root.children
      for (let i = children.length - 1; i >= 0; i--) {
        const node = children[i]
        children.splice(i, 1)
        group.children.push(
          new RemoveNodeCommand(`Flatten ${node.name}`, doc.root, node, i)
        )
      }
      const flat = getNodeKind('raster').create({
        name: 'Background',
        contentId: content.register(canvas),
        naturalWidth: doc.width,
        naturalHeight: doc.height,
        transform: { x: 0, y: 0, w: doc.width, h: doc.height, rotation: 0 }
      } as Partial<RasterData>) as SceneNode
      children.push(flat)
      group.children.push(
        new AddNodeCommand('Flatten Result', doc.root, flat, 0)
      )
      selectedIds = [flat.id]
      history.push(group)
      refresh()
      return true
    },
    flipImage(axis) {
      if (floating) anchorFloatingImpl()
      const W = doc.width
      const H = doc.height
      const group = new CommandGroup(
        axis === 'h' ? 'Flip Horizontal' : 'Flip Vertical'
      )

      const flipCanvas = (src: HTMLCanvasElement): HTMLCanvasElement | null => {
        const c = document.createElement('canvas')
        c.width = src.width
        c.height = src.height
        const g = c.getContext('2d')
        if (!g) return null
        if (axis === 'h') {
          g.translate(src.width, 0)
          g.scale(-1, 1)
        } else {
          g.translate(0, src.height)
          g.scale(1, -1)
        }
        g.drawImage(src, 0, 0)
        return c
      }
      const flipSlot = (
        slot: { contentId: string; url?: string },
        label: string
      ): void => {
        const entry = content.get(slot.contentId)
        if (!entry) return
        const flipped = flipCanvas(entry.canvas)
        if (!flipped) return
        const cmd = new SetContentCommand(
          label,
          slot,
          slot.contentId,
          content.register(flipped),
          content,
          slot.url
        )
        cmd.apply('redo')
        group.children.push(cmd)
      }
      const pushTransform = (n: SceneNode): void => {
        const before = { ...n.transform }
        const after: Transform =
          axis === 'h'
            ? {
                ...n.transform,
                x: W - n.transform.x - n.transform.w,
                rotation: -n.transform.rotation
              }
            : {
                ...n.transform,
                y: H - n.transform.y - n.transform.h,
                rotation: -n.transform.rotation
              }
        n.transform = after
        group.children.push(
          new PropCommand(
            'Flip',
            Dirty.DRAWABLE,
            () => n.transform,
            (v) => (n.transform = v),
            before,
            after
          )
        )
      }
      const walk = (nodes: SceneNode[]): void => {
        for (const n of nodes) {
          if (n.mask?.contentId) flipSlot(n.mask, 'Flip Mask')
          switch (n.kind) {
            case 'group':
              walk((n as GroupData).children)
              break
            case 'raster':
              flipSlot(n as RasterData, 'Flip Layer')
              pushTransform(n)
              break
            default:
              pushTransform(n)
          }
        }
      }
      walk(doc.root.children)
      if (group.empty) return false
      history.push(group)
      refresh()
      return true
    },
    cropToContent(id) {
      const ok = cropToContentOp(layerOpDeps(), id)
      if (ok) refresh()
      return ok
    },
    layerToCanvasSize(id) {
      const ok = layerToCanvasSizeOp(layerOpDeps(), id, doc.width, doc.height)
      if (ok) refresh()
      return ok
    },
    selectionBounds() {
      return selectionChannel()?.bounds ?? null
    },
    setRectSelection(rect) {
      const clamped = clampRectToDoc(rect, doc.width, doc.height)
      if (!clamped) return false
      return commitSelection(
        'Select Rectangle',
        rectSelectionCanvas(doc.width, doc.height, clamped),
        clamped
      )
    },
    selectAll() {
      const rect: Rect = { x: 0, y: 0, w: doc.width, h: doc.height }
      return commitSelection(
        'Select All',
        fullSelectionCanvas(doc.width, doc.height),
        rect
      )
    },
    selectNone() {
      return commitSelection('Select None', null, null)
    },
    paintPreview(key) {
      return overrides.get(key)?.canvas ?? null
    },
    setPaintPreview(key, canvas) {
      setPreviewOverride(key, canvas)
    },
    maskToSelection(id) {
      const node = findNode(doc.root, id)?.node
      const m = node?.mask
      if (!node || !m) return false
      const entry = content.get(m.contentId)
      if (!entry) return false
      const canvas = document.createElement('canvas')
      canvas.width = doc.width
      canvas.height = doc.height
      const g = canvas.getContext('2d')
      if (!g) return false
      g.fillStyle = '#000000'
      g.fillRect(0, 0, doc.width, doc.height)
      const tf =
        node.transform.w > 0 && node.transform.h > 0
          ? node.transform
          : { x: 0, y: 0, w: entry.width, h: entry.height, rotation: 0 }
      drawPlacedInto(g, entry.canvas, tf, 0, 0)
      const bounds = lumaBBox(canvas)
      if (!bounds) return commitSelection('Select None', null, null)
      return commitSelection('Mask to Selection', canvas, bounds)
    },
    invertSelection() {
      const sel = selectionChannel()
      if (!sel) return false
      const entry = content.get(sel.contentId)
      if (!entry) return false
      const inverted = invertSelectionCanvas(entry.canvas)
      if (!inverted) return false
      const bounds = lumaBBox(inverted)
      if (!bounds) return commitSelection('Select None', null, null)
      return commitSelection('Invert Selection', inverted, bounds)
    },
    floating: () => floating,
    startFloating(contentId, width, height, name) {
      if (floating) anchorFloatingImpl()
      const sel = selectionChannel()
      const target = sel?.bounds ?? { x: 0, y: 0, w: doc.width, h: doc.height }
      if (sel) commitSelection('Select None', null, null)
      const x = Math.round(target.x + (target.w - width) / 2)
      const y = Math.round(target.y + (target.h - height) / 2)
      floating = {
        contentId,
        name,
        transform: {
          x:
            width <= doc.width
              ? Math.max(0, Math.min(x, doc.width - width))
              : x,
          y:
            height <= doc.height
              ? Math.max(0, Math.min(y, doc.height - height))
              : y,
          w: width,
          h: height,
          rotation: 0
        }
      }
      floatSession = { mode: 'idle' }
      refresh()
    },
    anchorFloating(target) {
      anchorFloatingImpl(target)
    },
    cancelFloating() {
      if (!floating) return
      floating = null
      floatSession = { mode: 'idle' }
      collectGarbage()
      refresh()
    }
  }
}
