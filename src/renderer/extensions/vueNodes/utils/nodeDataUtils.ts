import type { INodeInputSlot, INodeSlot } from '@/lib/litegraph/src/interfaces'
import { useLinkStore } from '@/stores/linkStore'
import type { NodeId } from '@/types/nodeId'
import { isSlotObject } from '@/utils/typeGuardUtil'
import type { UUID } from '@/utils/uuid'

function coerceINodeSlot(input: INodeInputSlot): INodeSlot {
  return isSlotObject(input)
    ? input
    : {
        name: typeof input === 'string' ? input : '',
        type: 'any',
        boundingRect: [0, 0, 0, 0]
      }
}

function inputHasWidget(input: INodeInputSlot) {
  return isSlotObject(input) && 'widget' in input && input.widget
}

export function nonWidgetedInputs(
  inputs: INodeInputSlot[] | undefined
): INodeSlot[] {
  if (!inputs) return []

  return inputs.filter((input) => !inputHasWidget(input)).map(coerceINodeSlot)
}

export function linkedWidgetedInputs(
  nodeId: NodeId,
  inputs: INodeInputSlot[] | undefined,
  graphId: UUID
): INodeSlot[] {
  if (!inputs) return []

  const linkStore = useLinkStore()
  return inputs
    .filter(
      (input, index) =>
        inputHasWidget(input) &&
        linkStore.isInputSlotConnected(graphId, nodeId, index)
    )
    .map(coerceINodeSlot)
}
