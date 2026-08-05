import { defaultMode } from '../mode'
import type { NodeKind } from '../nodeKind'
import { getNodeKind, hasNodeKind } from '../nodeKind'
import type { GroupData, Rect, SceneNode, Transform } from '../node'
import { generateId } from '../id'

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && isFinite(v) ? v : d
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d

function fullTransform(): Transform {
  return { x: 0, y: 0, w: 0, h: 0, rotation: 0 }
}

export const groupKind: NodeKind<GroupData> = {
  kind: 'group',

  create(init: Partial<GroupData> = {}): GroupData {
    return {
      kind: 'group',
      id: init.id ?? generateId('group'),
      name: init.name ?? 'Group',
      visible: init.visible ?? true,
      opacity: init.opacity ?? 1,
      mode: init.mode ?? defaultMode('normal'),
      transform: init.transform ?? fullTransform(),
      locks: init.locks ?? {
        content: false,
        position: false,
        visibility: false
      },
      children: init.children ?? [],
      passThrough: init.passThrough ?? false,
      mask: init.mask
    }
  },

  normalize(raw: unknown): GroupData {
    const r = (raw ?? {}) as Record<string, unknown>
    const locks = (r.locks ?? {}) as Record<string, unknown>
    const t = (r.transform ?? {}) as Record<string, unknown>
    const rawChildren = Array.isArray(r.children) ? r.children : []
    const children: SceneNode[] = []
    for (const c of rawChildren) {
      const kind = (c as Record<string, unknown>)?.kind
      if (typeof kind === 'string' && hasNodeKind(kind)) {
        children.push(getNodeKind(kind).normalize(c) as SceneNode)
      }
    }
    return {
      kind: 'group',
      id: str(r.id, generateId('group')),
      name: str(r.name, 'Group'),
      visible: bool(r.visible, true),
      opacity: Math.max(0, Math.min(1, num(r.opacity, 1))),
      mode: (r.mode as GroupData['mode']) ?? defaultMode('normal'),
      transform: {
        x: num(t.x, 0),
        y: num(t.y, 0),
        w: num(t.w, 0),
        h: num(t.h, 0),
        rotation: num(t.rotation, 0)
      },
      locks: {
        content: bool(locks.content, false),
        position: bool(locks.position, false),
        visibility: bool(locks.visibility, false)
      },
      children,
      passThrough: bool(r.passThrough, false),
      mask: r.mask as GroupData['mask']
    }
  },

  serialize(node: GroupData): unknown {
    return {
      kind: 'group',
      id: node.id,
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      mode: node.mode,
      transform: node.transform,
      locks: node.locks,
      passThrough: node.passThrough,
      mask: node.mask,
      children: node.children.map((c) => getNodeKind(c.kind).serialize(c))
    }
  },

  contentIds(node: GroupData): string[] {
    const ids: string[] = []
    if (node.mask) ids.push(node.mask.contentId)
    for (const c of node.children)
      ids.push(...getNodeKind(c.kind).contentIds(c))
    return ids.filter(Boolean)
  },

  async hydrate(node: GroupData, deps): Promise<void> {
    if (node.mask && !deps.content.has(node.mask.contentId) && node.mask.url) {
      const canvas = await deps.loadUrl(node.mask.url)
      deps.content.register(canvas, {
        id: node.mask.contentId,
        uploadedUrl: node.mask.url
      })
    }
    await Promise.all(
      node.children.map((c) => getNodeKind(c.kind).hydrate(c, deps))
    )
  },

  renderNode(): null {
    return null
  },

  bbox(node: GroupData): Rect {
    if (node.children.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const c of node.children) {
      const b = getNodeKind(c.kind).bbox(c)
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.w)
      maxY = Math.max(maxY, b.y + b.h)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  },

  thumbnail(): HTMLCanvasElement | null {
    return null
  }
}
