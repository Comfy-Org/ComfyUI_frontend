import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { NodeBoundsUpdate } from '@/renderer/core/layout/types'

export function syncLayoutStoreNodeBoundsFromGraph(graph: LGraph): void {
  if (!LiteGraph.vueNodesMode) return

  const nodes = graph.nodes ?? []
  if (nodes.length === 0) return

  const updates: NodeBoundsUpdate[] = nodes.map((node) => ({
    nodeId: String(node.id),
    bounds: {
      x: node.pos[0],
      y: node.pos[1],
      width: node.size[0],
      height: node.size[1]
    }
  }))

  layoutStore.batchUpdateNodeBounds(updates)
}
