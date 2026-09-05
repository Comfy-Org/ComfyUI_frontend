import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { registerNodeState, unregisterNodeState } from './nodeShellState'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { WidgetDetachMode } from '@/stores/clearNodeOwnedStoreState'
import type { NodeId } from '@/types/nodeId'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/utils/uuid'

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

function releaseNodePreviewExposures(
  rootGraphId: UUID,
  node: LGraphNode
): void {
  const previewExposureStore = usePreviewExposureStore()
  const hostNodeLocator = String(node.id)
  if (!previewExposureStore.getExposures(rootGraphId, hostNodeLocator).length) {
    return
  }
  previewExposureStore.setExposures(rootGraphId, hostNodeLocator, [])
}

/**
 * The inverse of {@link attachNodeToStores}: drops the node's shell state, the
 * widget order it registered, and the preview exposures it hosts.
 */
export function detachNodeFromStores(
  graph: Pick<LGraph, 'rootGraph'>,
  node: LGraphNode,
  mode: WidgetDetachMode = 'keep-values'
): void {
  const rootGraphId = graph.rootGraph.id
  unregisterNodeState(node)
  useWidgetValueStore().releaseNodeWidgets(rootGraphId, node.id, {
    discardValues: mode === 'discard-values'
  })
  releaseNodePreviewExposures(rootGraphId, node)
}

/**
 * Detaches every node a graph owns, including those inside the subgraph
 * definitions it holds. Used when a graph's nodes leave the stores without a
 * whole-bucket wipe: subgraph-definition removal, and clearing a graph that
 * shares its bucket with other graphs. The graph is going away, so its nodes'
 * widget values go with it — the same reach as the wipe a root graph performs.
 */
export function detachAllNodesFromStores(
  graph: Pick<LGraph, '_nodes' | '_subgraphs' | 'rootGraph'>
): void {
  for (const node of graph._nodes) {
    detachNodeFromStores(graph, node, 'discard-values')
  }
  for (const subgraph of graph._subgraphs.values()) {
    detachAllNodesFromStores(subgraph)
  }
}
