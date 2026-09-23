import { SetTransformCommand } from '../commands/setTransform'
import { filterTopmost, findNode, flattenTree } from '../document'
import { CommandGroup, Dirty } from '../history'
import type { Command } from '../history'
import type { SceneNode, Transform, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import { applySnap, buildSnapTargets } from '../snapping'
import type { Guide, SnapTargets } from '../snapping'
import { defaultControl } from '../tool'
import type { Overlay, Tool, ToolContext, ToolControl, ToolDef } from '../tool'
import { addTransformBox } from './overlayBox'
import {
  alignedTo,
  angleTo,
  applyMove,
  applyResize,
  applyRotate,
  center,
  groupResize,
  groupScale,
  hitHandle,
  insideBox,
  rotateAround,
  scaleAround,
  scaleAroundFrame,
  unionBounds
} from './transformMath'
import type { HandleId } from './transformMath'

const TRANSFORMABLE_KINDS = new Set(['raster', 'text', 'vector'])

interface TransformSession {
  ids: string[]
  before: Map<string, Transform>
  gizmo: Transform
}

type Drag =
  | { mode: 'idle' }
  | {
      mode: 'move'
      start: Vec2
      gizmoBase: Transform
      bases: Map<string, Transform>
    }
  | {
      mode: 'resize'
      handle: HandleId
      gizmoBase: Transform
      bases: Map<string, Transform>
    }
  | {
      mode: 'rotate'
      gizmoBase: Transform
      grab: number
      bases: Map<string, Transform>
    }

export interface TransformToolApi {
  apply(): boolean
  cancel(): boolean
  isDirty(): boolean
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

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

export function canTransformNode(node: SceneNode | null): node is SceneNode {
  return !!node && TRANSFORMABLE_KINDS.has(node.kind) && !node.locks.position
}

function computeGizmo(targets: SceneNode[]): Transform {
  return targets.length === 1
    ? { ...targets[0].transform }
    : unionBounds(targets.map((n) => n.transform))
}

class TransformTool implements Tool, TransformToolApi {
  readonly control: ToolControl
  private session: TransformSession | null = null
  private drag: Drag = { mode: 'idle' }
  private snapGuides: Guide[] = []

  constructor(
    readonly id: string,
    private readonly ctx: ToolContext
  ) {
    this.control = {
      ...defaultControl(),
      cursor: 'default',
      abortMask: Dirty.STRUCTURE
    }
  }

  private tol(): number {
    return 8 / Math.max(1e-3, this.ctx.zoom())
  }

  private snapContext(excludeIds: Set<string>): {
    targets: SnapTargets
    rects: Transform[]
  } {
    const doc = this.ctx.document()
    const rects = flattenTree(doc.root)
      .filter(
        (n) =>
          n.visible && TRANSFORMABLE_KINDS.has(n.kind) && !excludeIds.has(n.id)
      )
      .map((n) => unionBounds([n.transform]))
    const grid = this.ctx.snapGrid()
    const guides = doc.guides ?? []
    const targets = buildSnapTargets(
      rects,
      { w: doc.width, h: doc.height },
      {
        gridX: grid > 0 ? grid : undefined,
        gridY: grid > 0 ? grid : undefined,
        guideXs: guides.filter((g) => g.axis === 'x').map((g) => g.pos),
        guideYs: guides.filter((g) => g.axis === 'y').map((g) => g.pos)
      }
    )
    return { targets, rects }
  }

  private snapMove(
    gizmo: Transform,
    excludeIds: Set<string>
  ): { dx: number; dy: number } {
    const doc = this.ctx.document()
    const aabb = unionBounds([gizmo])
    const thr = this.tol()
    const { targets, rects } = this.snapContext(excludeIds)
    const res = applySnap('move', aabb, targets, {
      thrX: thr,
      thrY: thr,
      minWH: 1,
      boundsW: doc.width,
      boundsH: doc.height,
      clamp: false,
      eqRects: rects
    })
    this.snapGuides = res.guides
    return { dx: res.rect.x - aabb.x, dy: res.rect.y - aabb.y }
  }

  private snapResize(
    next: Transform,
    handle: HandleId,
    excludeIds: Set<string>
  ): Transform {
    if (handle === 'rotate' || Math.abs(next.rotation) > 1e-6) return next
    const doc = this.ctx.document()
    const thr = this.tol()
    const aabb = unionBounds([next])
    const res = applySnap(handle, aabb, this.snapContext(excludeIds).targets, {
      thrX: thr,
      thrY: thr,
      minWH: 1,
      boundsW: doc.width,
      boundsH: doc.height,
      clamp: false
    })
    this.snapGuides = res.guides
    return {
      ...next,
      x: res.rect.x,
      y: res.rect.y,
      w: res.rect.w,
      h: res.rect.h
    }
  }

  private eligibleTargets(): SceneNode[] {
    const root = this.ctx.document().root
    return filterTopmost(root, this.ctx.selectedNodeIds())
      .map((id) => findNode(root, id)?.node ?? null)
      .filter((n): n is SceneNode => canTransformNode(n))
  }

  private sessionNodes(): SceneNode[] {
    if (!this.session) return []
    const root = this.ctx.document().root
    return this.session.ids
      .map((id) => findNode(root, id)?.node ?? null)
      .filter((n): n is SceneNode => !!n)
  }

  private ensureSession(): SceneNode[] | null {
    const targets = this.eligibleTargets()
    if (!targets.length) {
      if (this.session) this.apply()
      return null
    }
    const ids = targets.map((n) => n.id)
    if (this.session && !sameIds(this.session.ids, ids)) this.apply()
    if (!this.session) {
      const before = new Map<string, Transform>()
      for (const n of targets) before.set(n.id, { ...n.transform })
      this.session = { ids, before, gizmo: computeGizmo(targets) }
    }
    return targets
  }

  onActivate(): void {
    this.ensureSession()
  }

  onDeactivate(): void {
    if (this.isDirty()) this.apply()
    else this.session = null
  }

  onButtonPress(_e: PointerEvent, pt: Vec2): void {
    const targets = this.ensureSession()
    const s = this.session
    if (!targets || !s) return
    const bases = new Map<string, Transform>()
    for (const n of this.sessionNodes()) bases.set(n.id, { ...n.transform })
    const gizmoBase = { ...s.gizmo }
    const h = hitHandle(s.gizmo, pt, this.tol())
    if (h === 'rotate') {
      this.drag = {
        mode: 'rotate',
        gizmoBase,
        grab: angleTo(s.gizmo, pt),
        bases
      }
      return
    }
    if (h) {
      this.drag = { mode: 'resize', handle: h, gizmoBase, bases }
      return
    }
    if (insideBox(s.gizmo, pt)) {
      this.drag = { mode: 'move', start: pt, gizmoBase, bases }
      return
    }
    this.apply()
  }

  private setTransform(id: string, t: Transform): void {
    const node = findNode(this.ctx.document().root, id)?.node
    if (node) node.transform = t
  }

  onMotion(e: PointerEvent, pt: Vec2): void {
    const s = this.session
    const d = this.drag
    if (!s || d.mode === 'idle') return
    const single = d.bases.size === 1
    this.snapGuides = []
    if (d.mode === 'move') {
      let dx = pt.x - d.start.x
      let dy = pt.y - d.start.y
      if (!e.altKey) {
        const adj = this.snapMove(
          applyMove(d.gizmoBase, dx, dy),
          new Set(d.bases.keys())
        )
        dx += adj.dx
        dy += adj.dy
      }
      s.gizmo = applyMove(d.gizmoBase, dx, dy)
      for (const [id, base] of d.bases)
        this.setTransform(id, applyMove(base, dx, dy))
    } else if (d.mode === 'resize') {
      if (single) {
        let next = applyResize(d.gizmoBase, d.handle, pt, 1, e.shiftKey)
        if (!e.altKey && !e.shiftKey) {
          next = this.snapResize(next, d.handle, new Set(d.bases.keys()))
        }
        s.gizmo = next
        for (const [id] of d.bases) this.setTransform(id, next)
      } else {
        const frame = d.gizmoBase.rotation
        const nonUniform =
          !e.shiftKey &&
          [...d.bases.values()].every((b) => alignedTo(b.rotation, frame))
        if (nonUniform) {
          const { gizmo, anchor, sx, sy } = groupScale(
            d.gizmoBase,
            d.handle,
            pt,
            1
          )
          s.gizmo = gizmo
          for (const [id, base] of d.bases)
            this.setTransform(id, scaleAroundFrame(base, anchor, frame, sx, sy))
        } else {
          const { gizmo, anchor, scale } = groupResize(
            d.gizmoBase,
            d.handle,
            pt,
            1
          )
          s.gizmo = gizmo
          for (const [id, base] of d.bases)
            this.setTransform(id, scaleAround(base, anchor, scale))
        }
      }
    } else {
      const next = applyRotate(
        d.gizmoBase,
        d.gizmoBase.rotation,
        d.grab,
        pt,
        e.shiftKey ? Math.PI / 12 : 0
      )
      const theta = next.rotation - d.gizmoBase.rotation
      const pivot = center(d.gizmoBase)
      s.gizmo = next
      for (const [id, base] of d.bases)
        this.setTransform(id, rotateAround(base, pivot, theta))
    }
    this.ctx.requestRender()
  }

  onButtonRelease(): void {
    this.drag = { mode: 'idle' }
    this.snapGuides = []
    this.ctx.requestRender()
  }

  onHover(): void {
    this.ensureSession()
  }

  cursorFor(pt: Vec2): string {
    const gizmo = this.currentGizmo()
    if (!gizmo) return 'default'
    if (hitHandle(gizmo, pt, this.tol())) return 'pointer'
    if (insideBox(gizmo, pt)) return 'move'
    return 'default'
  }

  private currentGizmo(): Transform | null {
    if (this.session) return this.session.gizmo
    const targets = this.eligibleTargets()
    return targets.length ? computeGizmo(targets) : null
  }

  drawOverlay(overlay: Overlay): void {
    const targets = this.session ? this.sessionNodes() : this.eligibleTargets()
    if (!targets.length) return
    const gizmo = this.session?.gizmo ?? computeGizmo(targets)
    if (targets.length > 1) {
      for (const n of targets) {
        const b = n.transform
        if (b.w > 0 && b.h > 0) addTransformBox(overlay, b, false)
      }
    }
    addTransformBox(overlay, gizmo, true)
    const doc = this.ctx.document()
    const tick = 4 / Math.max(1e-3, this.ctx.zoom())
    for (const g of this.snapGuides) {
      if (g.kind === 'gap' && g.spans && g.cross != null) {
        for (const [a, b] of g.spans) {
          if (g.axis === 'x') {
            overlay.add({
              type: 'line',
              a: { x: a, y: g.cross },
              b: { x: b, y: g.cross }
            })
            overlay.add({
              type: 'line',
              a: { x: a, y: g.cross - tick },
              b: { x: a, y: g.cross + tick }
            })
            overlay.add({
              type: 'line',
              a: { x: b, y: g.cross - tick },
              b: { x: b, y: g.cross + tick }
            })
          } else {
            overlay.add({
              type: 'line',
              a: { x: g.cross, y: a },
              b: { x: g.cross, y: b }
            })
            overlay.add({
              type: 'line',
              a: { x: g.cross - tick, y: a },
              b: { x: g.cross + tick, y: a }
            })
            overlay.add({
              type: 'line',
              a: { x: g.cross - tick, y: b },
              b: { x: g.cross + tick, y: b }
            })
          }
        }
        continue
      }
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
  }

  isDirty(): boolean {
    const s = this.session
    if (!s) return false
    for (const [id, before] of s.before) {
      const node = findNode(this.ctx.document().root, id)?.node
      if (node && !sameTransform(before, node.transform)) return true
    }
    return false
  }

  private buildCommands(s: TransformSession): Command[] {
    const cmds: Command[] = []
    for (const [id, before] of s.before) {
      const node = findNode(this.ctx.document().root, id)?.node
      if (!node || sameTransform(before, node.transform)) continue
      cmds.push(
        new SetTransformCommand('transform', node, before, {
          ...node.transform
        })
      )
      const extra =
        getNodeKind(node.kind).onTransformCommitted?.(node, before, {
          content: this.ctx.content
        }) ?? null
      if (extra) cmds.push(extra)
    }
    return cmds
  }

  apply(): boolean {
    const s = this.session
    this.session = null
    this.drag = { mode: 'idle' }
    this.snapGuides = []
    if (!s) return false
    const cmds = this.buildCommands(s)
    if (!cmds.length) return false
    if (cmds.length === 1) {
      this.ctx.history.push(cmds[0])
    } else {
      const group = new CommandGroup('transform')
      group.children.push(...cmds)
      this.ctx.history.push(group)
    }
    this.ctx.requestRender()
    return true
  }

  cancel(): boolean {
    const s = this.session
    this.session = null
    this.drag = { mode: 'idle' }
    this.snapGuides = []
    if (!s) return false
    let changed = false
    for (const [id, before] of s.before) {
      const node = findNode(this.ctx.document().root, id)?.node
      if (node && !sameTransform(before, node.transform)) {
        node.transform = { ...before }
        changed = true
      }
    }
    if (changed) this.ctx.requestRender()
    return changed
  }
}

export function isTransformTool(
  tool: Tool | null
): tool is Tool & TransformToolApi {
  return !!tool && tool.id === 'transform'
}

export function makeTransformToolDef(): ToolDef {
  return {
    id: 'transform',
    create: (ctx) => new TransformTool('transform', ctx)
  }
}
