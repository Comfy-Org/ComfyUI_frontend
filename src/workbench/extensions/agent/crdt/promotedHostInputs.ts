import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import { useWidgetValueStore } from '@comfyorg/graph-state/widgetValueStore'

interface PromotedHostInput {
  input: INodeInputSlot
  readValue(): unknown
}

/**
 * The inputs behind a subgraph host's positional `widgets_values`, in the
 * order the host saves them, with each slot's current value.
 */
export function promotedHostInputs(node: LGraphNode): PromotedHostInput[] {
  return node.inputs.flatMap((input): PromotedHostInput[] => {
    const id = input.widgetId
    if (id)
      return [
        { input, readValue: () => useWidgetValueStore().getWidget(id)?.value }
      ]
    if (!input.widget) return []
    const owned = node.getWidgetFromSlot(input)
    if (!owned || owned.serialize === false) return []
    return [{ input, readValue: () => owned.value }]
  })
}
