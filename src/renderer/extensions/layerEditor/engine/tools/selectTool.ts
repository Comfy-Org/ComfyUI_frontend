import { SetTransformCommand } from '../commands/setTransform'
import { filterTopmost, findNode } from '../document'
import { CommandGroup, Dirty } from '../history'
import type { Command } from '../history'
import type { SceneNode, Transform, Vec2 } from '../node'
import { getNodeKind } from '../nodeKind'
import { defaultControl } from '../tool'
import type { Overlay, Tool, ToolContext, ToolControl, ToolDef } from '../tool'
import {
  PICK_OPACITY_THRESHOLD,
  layerOpacityAt,
  pickLayerAt
} from '../editor/pickOps'
import { addTransformBox } from './overlayBox'
import { applyMove } from './transformMath'

interface MoveTarget {
  node: SceneNode
  before: Transform
}

type Session =
  | { mode: 'idle' }
  | { mode: 'move'; start: Vec2; targets: MoveTarget[] }

function nodeBounds(node: SceneNode): Transform {
  if (node.kind !== 'group') return node.transform
  const b = getNodeKind('group').bbox(node)
  return { x: b.x, y: b.y, w: b.w, h: b.h, rotation: 0 }
}

function moveLeaves(node: SceneNode): SceneNode[] {
  if (node.locks.position) return []
  if (node.kind !== 'group') return [node]
  return node.children.flatMap((c) => moveLeaves(c))
}

class SelectTool implements Tool {
  readonly control: ToolControl
  private session: Session = { mode: 'idle' }

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

  private selectedNodes(): SceneNode[] {
    const root = this.ctx.document().root
    return filterTopmost(root, this.ctx.selectedNodeIds())
      .map((id) => findNode(root, id)?.node)
      .filter((n): n is SceneNode => !!n)
  }

  private startMove(nodes: SceneNode[], pt: Vec2): void {
    const targets = nodes
      .flatMap((n) => moveLeaves(n))
      .map((node) => ({ node, before: { ...node.transform } }))
    this.session = targets.length
      ? { mode: 'move', start: pt, targets }
      : { mode: 'idle' }
  }

  onButtonPress(e: PointerEvent, pt: Vec2): void {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const picked = this.pick(pt)
      if (picked) {
        const sel = this.ctx.selectedNodeIds()
        const at = sel.indexOf(picked.id)
        if (at >= 0) sel.splice(at, 1)
        else sel.push(picked.id)
        this.ctx.setSelectedNodes(sel)
      }
      this.session = { mode: 'idle' }
      return
    }
    const selMask = this.ctx.selection.currentMask()
    if (selMask) {
      const mx = Math.floor(pt.x)
      const my = Math.floor(pt.y)
      const insideSel =
        mx >= 0 &&
        my >= 0 &&
        mx < selMask.width &&
        my < selMask.height &&
        selMask.data[my * selMask.width + mx] >= 0.5
      if (insideSel && this.ctx.floatSelection()) {
        this.session = { mode: 'idle' }
        return
      }
    }
    const selected = this.selectedNodes()
    if (
      selected.some(
        (n) => layerOpacityAt(n, pt, this.ctx.content) > PICK_OPACITY_THRESHOLD
      )
    ) {
      this.startMove(selected, pt)
      return
    }
    const picked = this.pick(pt)
    if (picked) {
      this.ctx.setActiveNode(picked.id)
      this.startMove([picked], pt)
    } else {
      this.ctx.setActiveNode(null)
      this.session = { mode: 'idle' }
    }
  }

  onMotion(_e: PointerEvent, pt: Vec2): void {
    const s = this.session
    if (s.mode !== 'move') return
    for (const t of s.targets) {
      t.node.transform = applyMove(t.before, pt.x - s.start.x, pt.y - s.start.y)
    }
    this.ctx.requestRender()
  }

  private commitTransform(node: SceneNode, before: Transform): Command[] {
    const after = { ...node.transform }
    if (before.x === after.x && before.y === after.y) return []
    const cmds: Command[] = [
      new SetTransformCommand('move', node, before, after)
    ]
    const extra =
      getNodeKind(node.kind).onTransformCommitted?.(node, before, {
        content: this.ctx.content
      }) ?? null
    if (extra) cmds.push(extra)
    return cmds
  }

  onButtonRelease(): void {
    const s = this.session
    if (s.mode === 'move') {
      const cmds = s.targets.flatMap((t) =>
        this.commitTransform(t.node, t.before)
      )
      if (cmds.length === 1) {
        this.ctx.history.push(cmds[0])
        this.ctx.requestRender()
      } else if (cmds.length > 1) {
        const group = new CommandGroup('move')
        group.children.push(...cmds)
        this.ctx.history.push(group)
        this.ctx.requestRender()
      }
    }
    this.session = { mode: 'idle' }
  }

  onHover(): void {}

  cursorFor(pt: Vec2): string {
    for (const n of this.selectedNodes()) {
      if (layerOpacityAt(n, pt, this.ctx.content) > PICK_OPACITY_THRESHOLD) {
        return n.locks.position ? 'not-allowed' : 'move'
      }
    }
    return 'default'
  }

  drawOverlay(overlay: Overlay): void {
    for (const n of this.selectedNodes()) {
      const box = nodeBounds(n)
      if (box.w <= 0 || box.h <= 0) continue
      addTransformBox(overlay, box, false)
    }
  }

  private pick(pt: Vec2): SceneNode | null {
    return pickLayerAt(this.ctx.document().root.children, pt, this.ctx.content)
  }
}

export function makeSelectToolDef(): ToolDef {
  return { id: 'select', create: (ctx) => new SelectTool('select', ctx) }
}
