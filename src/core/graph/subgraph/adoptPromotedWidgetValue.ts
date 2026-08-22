import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

/**
 * Copies a promoted host widget's value onto the interior widget it forwards to.
 *
 * A promoted input holds the user-facing value on the host subgraph node and
 * never writes it through, so unpacking must move it or the edit is lost.
 */
export function adoptPromotedWidgetValue(
  hostInput: INodeInputSlot,
  targetNode: LGraphNode,
  targetSlot: number
): void {
  const { widgetId } = hostInput
  if (!widgetId) return

  const value = useWidgetValueStore().getWidget(widgetId)?.value
  if (value === undefined || !isWidgetValue(value)) return

  const targetInput: INodeInputSlot | undefined = targetNode.inputs[targetSlot]
  if (!targetInput) return

  const widget = targetNode.getWidgetFromSlot(targetInput)
  if (!widget) return

  widget.value = value
}
