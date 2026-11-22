import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

interface PromotedHostInput {
  input: INodeInputSlot
  /** The host's current value for this slot of the positional array. */
  readValue(): unknown
}

/**
 * The inputs behind a subgraph host's positional `widgets_values`, in the
 * order the host saves them (`SubgraphNode.serialize`).
 *
 * Two kinds of input hold a slot. A promoted interior widget is addressed by
 * `input.widgetId` and its value lives in the widget value store. A dynamic
 * combo or autogrow group promoted onto the host (#23321) has no widgetId:
 * the host owns the widget, bound through `input.widget.name`, and so do the
 * option widgets the combo adds after it. Counting only widgetId inputs drops
 * those, which shifts every later index against the document's array.
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
