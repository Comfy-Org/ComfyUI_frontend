/**
 * Layout Persistence Adapter
 *
 * Defines explicit conversion boundaries between store-backed state
 * and the serialized workflow format (ISerialisedNode).
 *
 * These pure functions codify the mapping contract for layout and
 * presentation fields, enabling future migration from LiteGraph-first
 * to store-first serialization.
 */
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { NodeId, NodeLayout } from '@/renderer/core/layout/types'
import type { NodeDisplayState } from '@/stores/nodeDisplayStore'

export function extractLayoutFromSerialized(
  node: ISerialisedNode,
  zIndex = 0
): NodeLayout {
  const id: NodeId = String(node.id)
  const x = node.pos[0]
  const y = node.pos[1]
  const width = node.size[0]
  const height = node.size[1]

  return {
    id,
    position: { x, y },
    size: { width, height },
    zIndex,
    visible: true,
    bounds: { x, y, width, height }
  }
}

export function extractPresentationFromSerialized(
  node: ISerialisedNode
): NodeDisplayState {
  return {
    id: String(node.id),
    title: node.title ?? '',
    mode: node.mode,
    shape: node.shape,
    showAdvanced: node.showAdvanced,
    color: node.color,
    bgcolor: node.bgcolor,
    flags: {
      collapsed: node.flags?.collapsed,
      pinned: node.flags?.pinned,
      ghost: node.flags?.ghost
    }
  }
}
