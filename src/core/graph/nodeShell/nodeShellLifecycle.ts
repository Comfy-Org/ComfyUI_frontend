import { unregisterAllLinkTopologies } from '@/lib/litegraph/src/LLink'
import { unregisterAllRerouteChains } from '@/lib/litegraph/src/Reroute'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { zeroUuid } from '@/utils/uuid'

import { registerNodeState, unregisterAllNodeStates } from './nodeShellState'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'

/**
 * Registers a node's shell state and its widget bindings with the app stores.
 * Call once the node has a valid id and graph reference.
 */
export function attachNodeToStores(
  graph: LGraph | Subgraph,
  node: LGraphNode
): void {
  registerNodeState(graph, node)

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

/**
 * Releases everything a graph owns in the app stores. A root graph owns its
 * whole bucket and can wipe it; subgraphs and unconfigured (zero-uuid) graphs
 * share their bucket with other graphs, so they unregister each entity
 * individually.
 */
export function releaseGraphStores(graph: LGraph | Subgraph): void {
  const graphId = graph.id
  if (graph.isRootGraph && graphId !== zeroUuid) {
    usePreviewExposureStore().clearGraph(graphId)
    useWidgetValueStore().clearGraph(graphId)
    useLinkStore().clearGraph(graphId)
    useRerouteStore().clearGraph(graphId)
    useNodeDataStore().clearGraph(graphId)
  } else {
    unregisterAllLinkTopologies(graph)
    unregisterAllRerouteChains(graph)
    unregisterAllNodeStates(graph)
  }
}
