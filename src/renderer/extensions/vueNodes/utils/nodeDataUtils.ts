import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { INodeSlot } from '@/lib/litegraph/src/interfaces'
import { isSlotObject } from '@/utils/typeGuardUtil'

export function nonWidgetedInputs(
  nodeData: VueNodeData | undefined
): INodeSlot[] {
  if (!nodeData?.inputs) return []

  return nodeData.inputs
    .filter((input) => {
      // Check if this slot has a widget property (indicating it has a corresponding widget)
      if (isSlotObject(input) && 'widget' in input && input.widget) {
        // This slot has a widget, so we should not display it separately
        return false
      }
      return true
    })
    .map(
      (input): INodeSlot =>
        isSlotObject(input)
          ? input
          : {
              name: typeof input === 'string' ? input : '',
              type: 'any',
              boundingRect: [0, 0, 0, 0]
            }
    )
}
