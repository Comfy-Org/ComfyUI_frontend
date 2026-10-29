import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'

import { isWidgetValue } from '@comfyorg/graph-model/widgets'
import { useWidgetValueStore } from '@comfyorg/graph-state/widgetValueStore'

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

  if (targetSlot < 0 || targetSlot >= targetNode.inputs.length) return
  const targetInput = targetNode.inputs[targetSlot]

  const widget = targetNode.getWidgetFromSlot(targetInput)
  if (!widget) return

  widget.value = value
}
