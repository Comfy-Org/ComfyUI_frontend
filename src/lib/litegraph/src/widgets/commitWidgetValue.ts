import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export interface WidgetValueCommitOptions {
  node: LGraphNode
  /** Absent for a programmatic write, which has no gesture context. */
  canvas?: LGraphCanvas
  e?: CanvasPointerEvent
}

/**
 * The one way a widget value changes: write it, sync a bound node property,
 * run the callback chain, notify the node, advance the graph version.
 *
 * Extracted from `BaseWidget.setValue` so a programmatic write commits through
 * the same protocol as a canvas edit — including on plain-object widgets,
 * which `addCustomWidget` can leave unwrapped in `node.widgets`.
 */
export function commitWidgetValue(
  widget: IBaseWidget,
  value: IBaseWidget['value'],
  { e, node, canvas }: WidgetValueCommitOptions
): void {
  const oldValue = widget.value
  if (value === oldValue) return

  const v = widget.type === 'number' ? Number(value) : value
  widget.value = v
  if (
    widget.options?.property &&
    node.properties[widget.options.property] !== undefined
  ) {
    node.setProperty(widget.options.property, v)
  }
  widget.callback?.(widget.value, canvas, node, canvas?.graph_mouse, e)

  node.onWidgetChanged?.(widget.name ?? '', v, oldValue, widget)
  if (node.graph) node.graph.incrementVersion()
}
