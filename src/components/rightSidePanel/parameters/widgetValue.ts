import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { WidgetState } from '@/types/widgetState'
import { widgetId } from '@/types/widgetId'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import type { WidgetValue } from '@/utils/widgetUtil'

/** The store state behind a widget shown in the properties panel. */
export function getWidgetState(
  node: LGraphNode,
  widget: IBaseWidget
): WidgetState | undefined {
  const widgetValueStore = useWidgetValueStore()
  if (widget.widgetId) return widgetValueStore.getWidget(widget.widgetId)
  const graphId = node.graph?.rootGraph.id
  const bareNodeId = stripGraphPrefix(node.id)
  return graphId && bareNodeId
    ? widgetValueStore.getWidget(widgetId(graphId, bareNodeId, widget.name))
    : undefined
}

/** Whether the node still holds the widget, so a write to it reaches the graph. */
export function isWidgetAttached(node: LGraphNode, widget: IBaseWidget) {
  return node.widgets?.includes(widget) ?? false
}

/** Whether a widget shown in the properties panel can only be read. */
export function isWidgetReadOnly(
  node: LGraphNode,
  widget: IBaseWidget
): boolean {
  const state = getWidgetState(node, widget)
  const options = state?.options ?? widget.options
  return Boolean(
    options.read_only ||
    options.disabled ||
    state?.disabled ||
    widget.disabled ||
    widget.computedDisabled
  )
}

/** Writes a widget value and clears the execution errors it resolves. */
export function useSetWidgetValue() {
  const canvasStore = useCanvasStore()
  const executionErrorStore = useExecutionErrorStore()
  const widgetValueStore = useWidgetValueStore()

  function clearWidgetErrors(
    widgetNode: LGraphNode,
    widget: IBaseWidget,
    value: WidgetValue
  ) {
    const rootGraph = widgetNode.graph?.rootGraph
    if (!rootGraph) return

    const executionId = getExecutionIdByNode(rootGraph, widgetNode)
    if (!executionId) return

    const options = { min: widget.options.min, max: widget.options.max }
    const source = resolvePromotedWidgetSource(rootGraph, widgetNode, widget)
    if (source?.sourceExecutionId) {
      executionErrorStore.clearWidgetRelatedErrors(
        source.sourceExecutionId,
        source.sourceWidgetName,
        source.sourceWidgetName,
        value,
        {
          min: source.sourceWidget.options.min,
          max: source.sourceWidget.options.max
        }
      )
    }

    executionErrorStore.clearWidgetRelatedErrors(
      executionId,
      widget.name,
      widget.name,
      value,
      options
    )
  }

  return function setWidgetValue(
    widgetNode: LGraphNode,
    widget: IBaseWidget,
    value: WidgetValue
  ) {
    if (widget.widgetId) widgetValueStore.setValue(widget.widgetId, value)
    widget.value = value
    widget.callback?.(value)
    clearWidgetErrors(widgetNode, widget, value)
    canvasStore.canvas?.setDirty(true, true)
  }
}
