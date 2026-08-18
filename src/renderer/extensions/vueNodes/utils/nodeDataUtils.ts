import type { INodeInputSlot, INodeSlot } from '@/lib/litegraph/src/interfaces'
import { isSlotObject } from '@/utils/typeGuardUtil'

interface NodeInputData {
  inputs?: INodeInputSlot[]
}

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
  nodeData: NodeInputData | undefined
): INodeSlot[] {
  if (!nodeData?.inputs) return []

  return nodeData.inputs
    .filter((input) => !inputHasWidget(input))
    .map(coerceINodeSlot)
}

export function linkedWidgetedInputs(
  nodeData: NodeInputData | undefined
): INodeSlot[] {
  if (!nodeData?.inputs) return []

  return nodeData.inputs
    .filter((input) => inputHasWidget(input) && !!input.link)
    .map(coerceINodeSlot)
}
