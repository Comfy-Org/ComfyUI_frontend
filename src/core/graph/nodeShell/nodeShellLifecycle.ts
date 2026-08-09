import { unregisterAllLinkTopologies } from '@/lib/litegraph/src/LLink'
import { unregisterAllRerouteChains } from '@/lib/litegraph/src/Reroute'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { unregisterAllGraphLayout } from '@/renderer/core/layout/operations/graphLayoutRegistration'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { zeroUuid } from '@/utils/uuid'

import { registerNodeState, unregisterNodeState } from './nodeShellState'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/utils/uuid'

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
 * Whether a detached node's widget values leave the store with it. A node that
 * may come back — undo of a deletion — keeps its values and drops only its
 * ordering; a node whose whole graph is going away takes its values along.
 */
type WidgetDetachMode = 'keep-values' | 'discard-values'

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
    layoutStore.clearGraph(graphId)
  } else {
    unregisterAllLinkTopologies(graph)
    unregisterAllRerouteChains(graph)
    detachAllNodesFromStores(graph)
    unregisterAllGraphLayout(graph)
  }
}
