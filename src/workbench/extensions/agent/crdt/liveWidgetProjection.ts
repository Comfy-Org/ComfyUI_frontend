import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

const VALUE_WIDGET_TYPES = new Set([
  'boolean',
  'combo',
  'image',
  'number',
  'slider',
  'string',
  'text',
  'toggle'
])

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

function warn(nodeId: NodeId, name: string, reason: string): false {
  console.warn(
    `[agent-crdt] live widget projection skipped for node ${nodeId}, widget ${name}: ${reason}`
  )
  return false
}

export function applyLiveWidgetValue(
  rootGraph: LGraph | undefined,
  scope: GraphScope,
  nodeId: NodeId,
  name: string,
  value: WidgetValue,
  context: RemoteMutationContext
): boolean {
  if (!rootGraph) return warn(nodeId, name, 'graph is not ready')
  const graph = owningGraph(rootGraph, scope)
  if (!graph) return warn(nodeId, name, 'owning graph was not found')
  const node = graph.getNodeById(nodeId)
  if (!node) return warn(nodeId, name, 'node was not found')
  const widget = node.widgets?.find((candidate) => candidate.name === name)
  if (!widget) return warn(nodeId, name, 'widget was not found')
  if (
    widget.serialize === false ||
    !VALUE_WIDGET_TYPES.has(widget.type.toLowerCase()) ||
    !isScalarValue(value)
  ) {
    return warn(nodeId, name, `unsupported widget type ${widget.type}`)
  }

  const previousValue = widget.value
  const widgetStore = useWidgetValueStore()
  const setValue = (nextValue: WidgetValue) => {
    if (
      !widget.widgetId ||
      !widgetStore.setValue(widget.widgetId, nextValue, context)
    ) {
      widget.value = nextValue
    }
  }
  setValue(value)
  try {
    widget.callback?.(value)
    node.onWidgetChanged?.(name, value, previousValue, widget)
  } catch (error) {
    setValue(previousValue)
    throw error
  }
  return true
}
