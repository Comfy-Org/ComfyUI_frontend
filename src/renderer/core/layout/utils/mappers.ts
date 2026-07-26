import * as Y from 'yjs'

import type { GroupLayout, NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

/**
 * A node's stored geometry: one `[x, y, width, height]` tuple. Position, size
 * and bounds are views of it rather than fields of their own, so they cannot
 * disagree, and a whole-tuple replace is the write a CRDT register wants.
 */
type StoredNodeRect = [x: number, y: number, width: number, height: number]

type StoredNode = {
  id: NodeId
  rect: StoredNodeRect
  zIndex: number
  visible: boolean
}

export type NodeLayoutMap = Y.Map<StoredNode[keyof StoredNode]>

const DEFAULT_RECT: StoredNodeRect = [0, 0, 100, 50]

export function layoutToYNode(layout: NodeLayout): NodeLayoutMap {
  const ynode = new Y.Map<StoredNode[keyof StoredNode]>() as NodeLayoutMap
  ynode.set('id', layout.id)
  ynode.set('rect', [
    layout.position.x,
    layout.position.y,
    layout.size.width,
    layout.size.height
  ])
  ynode.set('zIndex', layout.zIndex)
  ynode.set('visible', layout.visible)
  return ynode
}

function yNodeRect(ynode: NodeLayoutMap): StoredNodeRect {
  return (ynode.get('rect') as StoredNodeRect | undefined) ?? DEFAULT_RECT
}

export function yNodeToLayout(ynode: NodeLayoutMap): NodeLayout {
  const [x, y, width, height] = yNodeRect(ynode)
  return {
    id: (ynode.get('id') ?? toNodeId('unknown-node')) as NodeId,
    position: { x, y },
    size: { width, height },
    bounds: { x, y, width, height },
    zIndex: (ynode.get('zIndex') ?? 0) as number,
    visible: (ynode.get('visible') ?? true) as boolean
  }
}

export type GroupLayoutMap = Y.Map<GroupLayout[keyof GroupLayout]>

const GROUP_LAYOUT_DEFAULTS: Omit<GroupLayout, 'id'> = {
  position: { x: 0, y: 0 },
  size: { width: 140, height: 80 }
}

export function layoutToYGroup(layout: GroupLayout): GroupLayoutMap {
  const ygroup = new Y.Map<GroupLayout[keyof GroupLayout]>() as GroupLayoutMap
  ygroup.set('id', layout.id)
  ygroup.set('position', layout.position)
  ygroup.set('size', layout.size)
  return ygroup
}

export function yGroupToLayout(
  ygroup: GroupLayoutMap,
  groupId: GroupLayout['id']
): GroupLayout {
  return {
    id: (ygroup.get('id') ?? groupId) as GroupLayout['id'],
    position: (ygroup.get('position') ??
      GROUP_LAYOUT_DEFAULTS.position) as GroupLayout['position'],
    size: (ygroup.get('size') ??
      GROUP_LAYOUT_DEFAULTS.size) as GroupLayout['size']
  }
}
