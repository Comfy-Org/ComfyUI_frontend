import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { INodeInputSlot, INodeSlot } from '@/lib/litegraph/src/interfaces'
import { useLinkStore } from '@/stores/linkStore'
import { isSlotObject } from '@/utils/typeGuardUtil'

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
  nodeData: VueNodeData | undefined
): INodeSlot[] {
  if (!nodeData?.inputs) return []

  return nodeData.inputs
    .filter((input) => !inputHasWidget(input))
    .map(coerceINodeSlot)
}

export function linkedWidgetedInputs(
  nodeData: VueNodeData | undefined,
  graphId: string | undefined
): INodeSlot[] {
  if (!nodeData?.inputs || graphId === undefined) return []

  const linkStore = useLinkStore()
  return nodeData.inputs
    .filter(
      (input, index) =>
        inputHasWidget(input) &&
        linkStore.isInputSlotConnected(graphId, nodeData.id, index)
    )
    .map(coerceINodeSlot)
}
