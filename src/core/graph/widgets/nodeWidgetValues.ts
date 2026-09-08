import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

function nodeWidgetId(node: LGraphNode, name: string): WidgetId | null {
  const graphId = node.graph?.rootGraph.id
  return graphId ? widgetId(graphId, node.id, name) : null
}

export function getNodeWidgetValue(node: LGraphNode, name: string): unknown {
  const id = nodeWidgetId(node, name)
  const state = id ? useWidgetValueStore().getWidget(id) : undefined
  if (state) return state.value
  return node.widgets?.find((w) => w.name === name)?.value
}

export function setNodeWidgetValue(
  node: LGraphNode,
  name: string,
  value: WidgetValue
): boolean {
  const id = nodeWidgetId(node, name)
  const widget = node.widgets?.find((w) => w.name === name)
  const previousValue = getNodeWidgetValue(node, name)
  if (id && useWidgetValueStore().setValue(id, value)) {
    if (widget) {
      widget.callback?.(value)
      node.onWidgetChanged?.(name, value, previousValue, widget)
    }
    return true
  }
  if (!widget) return false
  widget.value = value
  widget.callback?.(value)
  node.onWidgetChanged?.(name, value, previousValue, widget)
  return true
}
