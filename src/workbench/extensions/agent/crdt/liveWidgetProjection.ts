import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
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

export interface LiveWidgetProjectionResult {
  /** Whether the value landed on a live widget (false = no live target, or rolled back). */
  applied: boolean
  /**
   * The value canonical state should converge on: the post-callback widget
   * value on success, or the restored `previousValue` after a rollback.
   * Undefined when no live widget was found at all.
   */
  resolvedValue: WidgetValue | undefined
}

function skipped(
  nodeId: NodeId,
  name: string,
  reason: string
): LiveWidgetProjectionResult {
  console.warn(
    `[agent-crdt] live widget projection skipped for node ${nodeId}, widget ${name}: ${reason}`
  )
  return { applied: false, resolvedValue: undefined }
}

function syncBackingProperty(
  node: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
): void {
  const property = widget.options.property
  if (property && node.properties[property] !== undefined) {
    node.setProperty(property, value)
  }
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
    !VALUE_WIDGET_TYPES.has(widget.type.toLowerCase()) ||
    !isScalarValue(value)
  ) {
    return skipped(nodeId, name, `unsupported widget type ${widget.type}`)
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
    syncBackingProperty(node, widget, nextValue)
  }
  setValue(value)
  try {
    widget.callback?.(value)
    node.onWidgetChanged?.(name, value, previousValue, widget)
  } catch (error) {
    setValue(previousValue)
    console.warn(
      `[agent-crdt] live widget projection callback failed for node ${nodeId}, widget ${name}`,
      error
    )
    return { applied: false, resolvedValue: previousValue }
  }
  return { applied: true, resolvedValue: widget.value }
}
