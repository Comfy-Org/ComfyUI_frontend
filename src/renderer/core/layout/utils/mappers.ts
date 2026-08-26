import * as Y from 'yjs'

import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import type { GroupLayout, NodeLayout } from '@/renderer/core/layout/types'
import { parseNodeId, toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

/**
 * Stored geometry: one `[x, y, width, height]` tuple. Position, size and bounds
 * are views of it rather than fields of their own, so they cannot disagree, and
 * a whole-tuple replace is the write a CRDT register wants.
 */
export type StoredRect = [x: number, y: number, width: number, height: number]

type StoredNode = {
  id: NodeId
  rect: StoredRect
  zIndex: number
  visible: boolean
}

export type NodeLayoutMap = Y.Map<StoredNode[keyof StoredNode]>

const DEFAULT_NODE_RECT: StoredRect = [0, 0, 100, 50]

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

function yNodeRect(ynode: NodeLayoutMap): Readonly<StoredRect> {
  return (ynode.get('rect') as StoredRect | undefined) ?? DEFAULT_NODE_RECT
}

export function yNodeToLayout(ynode: NodeLayoutMap): NodeLayout {
  const [x, y, width, height] = yNodeRect(ynode)
  return {
    id: parseNodeId(ynode.get('id')) ?? toNodeId('unknown-node'),
    position: { x, y },
    size: { width, height },
    bounds: { x, y, width, height },
    zIndex: (ynode.get('zIndex') ?? 0) as number,
    visible: (ynode.get('visible') ?? true) as boolean
  }
}

type StoredGroup = {
  id: GroupId
  rect: StoredRect
}

export type GroupLayoutMap = Y.Map<StoredGroup[keyof StoredGroup]>

const DEFAULT_GROUP_RECT: StoredRect = [0, 0, 140, 80]

export function layoutToYGroup(layout: GroupLayout): GroupLayoutMap {
  const ygroup = new Y.Map<StoredGroup[keyof StoredGroup]>() as GroupLayoutMap
  ygroup.set('id', layout.id)
  ygroup.set('rect', [
    layout.position.x,
    layout.position.y,
    layout.size.width,
    layout.size.height
  ])
  return ygroup
}

export function setYGroupRect(
  ygroup: GroupLayoutMap,
  position: GroupLayout['position'],
  size: GroupLayout['size']
): void {
  ygroup.set('rect', [position.x, position.y, size.width, size.height])
}

export function yGroupToLayout(
  ygroup: GroupLayoutMap,
  groupId: GroupId
): GroupLayout {
  const [x, y, width, height] =
    (ygroup.get('rect') as StoredRect | undefined) ?? DEFAULT_GROUP_RECT
  const storedId = ygroup.get('id')
  return {
    id: typeof storedId === 'number' ? toGroupId(storedId) : groupId,
    position: { x, y },
    size: { width, height }
  }
}
