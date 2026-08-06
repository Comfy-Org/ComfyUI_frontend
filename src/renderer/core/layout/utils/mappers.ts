import * as Y from 'yjs'

import type { GroupId } from '@/types/groupId'
import type { GroupLayout, NodeLayout } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

type StoredRect = [x: number, y: number, width: number, height: number]

type StoredNode = {
  id: NodeId
  rect: StoredRect
  position: NodeLayout['position']
  size: NodeLayout['size']
  visible: boolean
  zIndex: number
  registrationId?: string
}

export type NodeLayoutMap = Y.Map<StoredNode[keyof StoredNode]>

const DEFAULT_NODE_RECT: StoredRect = [0, 0, 100, 50]

export function layoutToYNode(
  layout: NodeLayout,
  registrationId?: string
): NodeLayoutMap {
  const ynode = new Y.Map<StoredNode[keyof StoredNode]>() as NodeLayoutMap
  ynode.set('id', layout.id)
  ynode.set('position', { ...layout.position })
  ynode.set('size', { ...layout.size })
  ynode.set('zIndex', layout.zIndex)
  ynode.set('visible', layout.visible)
  if (registrationId !== undefined) {
    ynode.set('registrationId', registrationId)
  }
  return ynode
}

export function yNodeGeometry(
  ynode: NodeLayoutMap
): Pick<NodeLayout, 'position' | 'size'> {
  const [x, y, width, height] =
    (ynode.get('rect') as StoredRect | undefined) ?? DEFAULT_NODE_RECT
  const storedPosition = (ynode.get('position') as
    | NodeLayout['position']
    | undefined) ?? { x, y }
  const storedSize = (ynode.get('size') as NodeLayout['size'] | undefined) ?? {
    width,
    height
  }
  return {
    position: { ...storedPosition },
    size: { ...storedSize }
  }
}

export function yNodeToLayout(ynode: NodeLayoutMap): NodeLayout {
  const { position, size } = yNodeGeometry(ynode)
  return {
    id: (ynode.get('id') ?? toNodeId('unknown-node')) as NodeId,
    position,
    size,
    bounds: { ...position, ...size },
    zIndex: (ynode.get('zIndex') ?? 0) as number,
    visible: (ynode.get('visible') ?? true) as boolean
  }
}

type StoredGroup = {
  id: GroupId
  rect: StoredRect
  registrationId?: string
}

export type GroupLayoutMap = Y.Map<StoredGroup[keyof StoredGroup]>

const DEFAULT_GROUP_RECT: StoredRect = [0, 0, 140, 80]

export function layoutToYGroup(
  layout: GroupLayout,
  registrationId?: string
): GroupLayoutMap {
  const ygroup = new Y.Map<StoredGroup[keyof StoredGroup]>() as GroupLayoutMap
  ygroup.set('id', layout.id)
  ygroup.set('rect', [
    layout.position.x,
    layout.position.y,
    layout.size.width,
    layout.size.height
  ])
  if (registrationId !== undefined) ygroup.set('registrationId', registrationId)
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
  return {
    id: (ygroup.get('id') ?? groupId) as GroupId,
    position: { x, y },
    size: { width, height }
  }
}
