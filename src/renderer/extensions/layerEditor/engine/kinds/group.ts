import { defaultMode } from '../mode'
import type { NodeKind } from '../nodeKind'
import { getNodeKind } from '../nodeKind'
import type { GroupData, Rect, Transform } from '../node'
import { generateId } from '../id'

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

  contentIds(node: GroupData): string[] {
    const ids: string[] = []
    if (node.mask) ids.push(node.mask.contentId)
    for (const c of node.children)
      ids.push(...getNodeKind(c.kind).contentIds(c))
    return ids.filter(Boolean)
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
  }
}
