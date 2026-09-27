import { BakeRasterCommand, snapshotRaster } from '../commands/bakeContent'
import { AddNodeCommand, ReorderCommand } from '../commands/structure'
import type { Compositor, CompositeInput } from '../compositor'
import type { ContentStore } from '../content'
import type { DocGuide, Document } from '../document'
import { findNode } from '../document'
import { History } from '../history'
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
import {
  bakeMaskInto,
  bakePlaced,
  drawPlacedInto,
  isIdentityPlacement,
  placedBounds
} from '../render/bake'
import { placeBitmap } from '../render/place'
import type { PlacedEntry } from '../render/renderStack'
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
import { isTransformTool } from '../tools/transformTool'
import { SetSelectionCommand, snapshotSelection } from '../commands/selection'
import { generateId } from '../id'

import { fullSelectionCanvas } from './selectionOps'
import type { GrayMask, SelectionOp } from './selectionMath'
import {
  combineMasks,
  emptyMask,
  maskBoundary,
  maskBounds,
  maskFromCanvas,
  maskToCanvas
} from './selectionMath'
import { OverlayList } from './overlayList'

interface FloatingItem {
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

function emptyDocument(width: number, height: number): Document {
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
  setTool(id: string): void
  activeToolId(): string
  transformApply(): boolean
  guides(): DocGuide[]
  activeNodeId(): string | null
  setActiveNode(id: string | null): void
  selectedNodeIds(): string[]
  setSelectedNodes(ids: string[]): void
  pointerDown(e: PointerEvent, pt: Vec2): void
  pointerMove(e: PointerEvent, pt: Vec2): void
  pointerUp(e: PointerEvent, pt: Vec2): void
  cursorAt(pt: Vec2): string
  addNode(node: SceneNode, index?: number, parentId?: string): void
  moveNode(id: string, dir: 1 | -1): boolean
  moveNodeTo(id: string, parentId: string | undefined, toIndex: number): boolean
  setZoom(z: number): void
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
  selectionBounds(): Rect | null
  selectAll(): boolean
  selectNone(): boolean
}

export function createEditor(opts: EditorOptions): Editor {
  const compositor = opts.compositor
  const content = opts.content ?? new DefaultContentStore()
  const history = new History()
  const notify = opts.onChange ?? (() => {})
  const overlay = new OverlayList(() => notify())

  const doc = emptyDocument(1024, 1024)
  let toolId = 'select'
  let tool: Tool | null = null
  let selectedIds: string[] = []
  let zoomLevel = 1
  const snapGridSize = 0

  const placedCache = new Map<string, PlacedEntry>()
  let presentFull = true
  let presentRect: Rect | null = null
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
      { content, compositor, devicePixelRatio: 1, placedCache },
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
    presentFull = true
    presentRect = null
    render()
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
    requestRender: refresh
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
    setTool(id) {
      toolId = id
      makeTool()
      buildOverlay()
      notify()
    },
    activeToolId: () => toolId,
    transformApply: () => (isTransformTool(tool) ? tool.apply() : false),
    activeNodeId: activeNodeIdOf,
    setActiveNode: setActive,
    selectedNodeIds: liveSelectedIds,
    setSelectedNodes: setSelected,
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
    setZoom(z) {
      zoomLevel = z
    },
    guides: () => (doc.guides ?? []).map((g) => ({ ...g })),
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
    selectionBounds() {
      return selectionChannel()?.bounds ?? null
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
