import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import type { WidgetValue } from '@/utils/widgetUtil'

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
