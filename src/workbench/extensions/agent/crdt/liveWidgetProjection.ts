import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

import { runMintPortsSuppressed } from './mintPortWiring'

function isScalarValue(value: WidgetValue): boolean {
  return (
    value === null || ['boolean', 'number', 'string'].includes(typeof value)
  )
}

function owningGraph(rootGraph: LGraph, scope: GraphScope): LGraph | null {
  if (rootGraph.id !== scope.rootGraphId) return null
  return String(scope.owningGraphId) === String(scope.rootGraphId)
    ? rootGraph
    : (rootGraph.subgraphs.get(scope.owningGraphId) ?? null)
}

export type LiveWidgetProjectionResult =
  | { status: 'skipped' }
  | { status: 'applied'; resolvedValue: WidgetValue }
  | { status: 'rolledBack'; resolvedValue: WidgetValue }

function skipped(
  nodeId: NodeId,
  name: string,
  reason: string
): LiveWidgetProjectionResult {
  console.warn(
    `[agent-crdt] live widget projection skipped for node ${nodeId}, widget ${name}: ${reason}`
  )
  return { status: 'skipped' }
}

function syncBackingProperty(
  node: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
): void {
  const property = widget.options.property
  if (property) node.setProperty(property, value)
}

export function applyLiveWidgetValue(
  rootGraph: LGraph | undefined,
  scope: GraphScope,
  nodeId: NodeId,
  name: string,
  value: WidgetValue,
  context: RemoteMutationContext
): LiveWidgetProjectionResult {
  if (!rootGraph) return skipped(nodeId, name, 'graph is not ready')
  const graph = owningGraph(rootGraph, scope)
  if (!graph) return skipped(nodeId, name, 'owning graph was not found')
  const node = graph.getNodeById(nodeId)
  if (!node) return skipped(nodeId, name, 'node was not found')
  const widget = node.widgets?.find((candidate) => candidate.name === name)
  if (!widget) return skipped(nodeId, name, 'widget was not found')
  if (
    widget.serialize === false ||
    widget.type === 'button' ||
    !isScalarValue(value)
  ) {
    return skipped(nodeId, name, `unsupported widget type ${widget.type}`)
  }

  const previousValue = widget.value
  const widgetStore = useWidgetValueStore()
  const setValue = (
    nextValue: WidgetValue,
    mutationContext?: RemoteMutationContext
  ) => {
    if (
      !widget.widgetId ||
      !widgetStore.setValue(widget.widgetId, nextValue, mutationContext)
    ) {
      widget.value = nextValue
    }
    syncBackingProperty(node, widget, nextValue)
  }
  setValue(value, context)
  try {
    runMintPortsSuppressed(() => {
      widget.callback?.(value)
      node.onWidgetChanged?.(name, value, previousValue, widget)
    })
  } catch (error) {
    setValue(previousValue, context)
    console.warn(
      `[agent-crdt] live widget projection callback failed for node ${nodeId}, widget ${name}`,
      error
    )
    return { status: 'rolledBack', resolvedValue: previousValue }
  }
  const resolvedValue = widget.value
  syncBackingProperty(node, widget, resolvedValue)
  if (!Object.is(resolvedValue, value)) {
    setValue(value, context)
    setValue(resolvedValue)
  }
  return { status: 'applied', resolvedValue }
}
