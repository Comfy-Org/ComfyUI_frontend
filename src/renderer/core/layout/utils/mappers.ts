import * as Y from 'yjs'

import type { NodeLayout } from '@/renderer/core/layout/types'

export const NODE_LAYOUT_DEFAULTS: NodeLayout = {
  id: 'unknown-node',
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  zIndex: 0,
  visible: true,
  bounds: { x: 0, y: 0, width: 100, height: 50 }
}

export function layoutToYNode(layout: NodeLayout): Y.Map<unknown> {
  const ynode = new Y.Map<unknown>()
  ynode.set('id', layout.id)
  ynode.set('position', layout.position)
  ynode.set('size', layout.size)
  ynode.set('zIndex', layout.zIndex)
  ynode.set('visible', layout.visible)
  ynode.set('bounds', layout.bounds)
  return ynode
}

function getOr<T>(map: Y.Map<unknown>, key: string, fallback: T): T {
  const v = map.get(key)
  return (v ?? fallback) as T
}

export function yNodeToLayout(ynode: Y.Map<unknown>): NodeLayout {
  return {
    id: getOr<NodeLayout['id']>(ynode, 'id', NODE_LAYOUT_DEFAULTS.id),
    position: getOr<NodeLayout['position']>(
      ynode,
      'position',
      NODE_LAYOUT_DEFAULTS.position
    ),
    size: getOr<NodeLayout['size']>(ynode, 'size', NODE_LAYOUT_DEFAULTS.size),
    zIndex: getOr<NodeLayout['zIndex']>(
      ynode,
      'zIndex',
      NODE_LAYOUT_DEFAULTS.zIndex
    ),
    visible: getOr<NodeLayout['visible']>(
      ynode,
      'visible',
      NODE_LAYOUT_DEFAULTS.visible
    ),
    bounds: getOr<NodeLayout['bounds']>(
      ynode,
      'bounds',
      NODE_LAYOUT_DEFAULTS.bounds
    )
  }
}
