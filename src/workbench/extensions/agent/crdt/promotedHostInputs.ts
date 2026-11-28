import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { isReplicatedValueWidget } from './widgetValuesForm'

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
    if (!owned || !isReplicatedValueWidget(owned)) return []
    return [{ input, readValue: () => owned.value }]
  })
}
