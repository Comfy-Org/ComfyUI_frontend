import type { NodeLayout } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'

interface PaintOrderNode {
  id: NodeId
  flags?: {
    collapsed?: boolean
  }
}

interface IndexedNode<T> {
  index: number
  node: T
}

function getPaintTier(
  node: PaintOrderNode,
  selectedNodeIds: ReadonlySet<NodeId>
): number {
  if (!node.flags?.collapsed) return 1
  return selectedNodeIds.has(node.id) ? 2 : 0
}

function orderTier<T extends PaintOrderNode>(
  nodes: IndexedNode<T>[],
  layouts: ReadonlyMap<NodeId, Pick<NodeLayout, 'zIndex'>>
): T[] {
  const orderedLayouts = nodes
    .filter(({ node }) => layouts.has(node.id))
    .toSorted((a, b) => {
      const zIndexDifference =
        layouts.get(a.node.id)!.zIndex - layouts.get(b.node.id)!.zIndex
      return zIndexDifference || a.index - b.index
    })

  let orderedLayoutIndex = 0
  return nodes.map(({ node }) =>
    layouts.has(node.id) ? orderedLayouts[orderedLayoutIndex++].node : node
  )
}

export function orderNodesForPainting<T extends PaintOrderNode>(
  nodes: readonly T[],
  layouts: ReadonlyMap<NodeId, Pick<NodeLayout, 'zIndex'>>,
  selectedNodeIds: ReadonlySet<NodeId>
): T[] {
  const tiers: Array<IndexedNode<T>[]> = [[], [], []]

  nodes.forEach((node, index) => {
    tiers[getPaintTier(node, selectedNodeIds)].push({ index, node })
  })

  return tiers.flatMap((tier) => orderTier(tier, layouts))
}
