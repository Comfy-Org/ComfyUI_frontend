import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { registerNodeState } from './nodeShellState'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'

/**
 * Registers a node's shell state and its widget bindings with the app
 * stores. Call once the node has a valid id and graph reference. Retries
 * with a freshly minted id on a registration collision.
 */
export function attachNodeToStores(
  graph: LGraph | Subgraph,
  node: LGraphNode,
  mintId: () => NodeId
): void {
  while (!registerNodeState(graph, node)) node.id = mintId()

  if (!node.widgets) return
  for (const widget of node.widgets) {
    if (isNodeBindable(widget)) widget.setNodeId(node.id)
  }
  useWidgetValueStore().setNodeWidgetOrder(
    graph.rootGraph.id,
    node.id,
    getWidgetIds(node.widgets)
  )
}
