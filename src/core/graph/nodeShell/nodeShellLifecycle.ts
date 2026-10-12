import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetRefusalReport } from '@/lib/litegraph/src/node/widgetsView'
import { refuseAmbiguousNodeWidgets } from '@/lib/litegraph/src/node/widgetsView'
import { isNodeBindable } from '@/lib/litegraph/src/utils/type'
import { getWidgetIds } from '@/lib/litegraph/src/utils/widget'
import { reportError } from '@/platform/telemetry/reportError'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { RefusedWidget } from '@/types/widgetId'

import { registerNodeState, unregisterNodeState } from './nodeShellState'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/utils/uuid'

const REFUSAL_TEARDOWN_ERROR_TYPE = 'failure_tearing_down_refused_widget'

const REFUSAL_ALERTS: Record<
  RefusedWidget<IBaseWidget>['cause'],
  {
    errorType: string
    message: (nodeId: LGraphNode['id'], name: string | undefined) => string
  }
> = {
  'unreadable-name': {
    errorType: 'failure_reading_widget_name',
    message: (nodeId) =>
      `Refused a widget on node ${nodeId}: no widget identity can be derived from its name`
  },
  'unresolved-duplicate': {
    errorType: 'failure_resolving_widget_duplicate_name',
    message: (nodeId, name) =>
      `Kept a widget named "${name}" that node ${nodeId} already has under that name: the rename was declined rather than impossible, so the widget is left in place and the pair is unresolved for now`
  },
  'duplicate-name': {
    errorType: 'failure_renaming_widget_duplicate_name',
    message: (nodeId, name) =>
      `Refused a widget named "${name}": node ${nodeId} already has a widget of that name and the duplicate cannot be renamed`
  }
}

function safeRead(read: () => unknown): string | undefined {
  try {
    const value = read()
    return value === undefined ? undefined : String(value)
  } catch {
    return undefined
  }
}

function reportWidgetRefusal(
  node: LGraphNode,
  report: WidgetRefusalReport
): void {
  if (report.kind === 'teardown-failure') {
    reportError(report.error, {
      errorType: REFUSAL_TEARDOWN_ERROR_TYPE,
      surface: 'graph',
      level: 'warning',
      tags: { node_type: node.type },
      context: { nodeId: String(node.id) }
    })
    return
  }

  const { widget, cause, name } = report.finding
  const alert = REFUSAL_ALERTS[cause]
  reportError(new Error(alert.message(node.id, name)), {
    errorType: alert.errorType,
    surface: 'graph',
    level: 'warning',
    tags: { node_type: node.type },
    context: {
      nodeId: String(node.id),
      widgetName: name,
      widgetType: safeRead(() => widget.type)
    }
  })
}

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
  while (!registerNodeState(graph, node)) {
    const collidedId = node.id
    node.id = mintId()
    console.warn(
      `[nodeShell] Node id ${collidedId} is already registered in root graph ${graph.rootGraph.id}; reminted as ${node.id}.`
    )
  }

  refuseAmbiguousNodeWidgets(node, (report) =>
    reportWidgetRefusal(node, report)
  )
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
