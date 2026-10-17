import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { isBoundingBox } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { BoundingBoxInput } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

export function useIncomingBoundingBoxes(
  node: ComputedRef<LGraphNode | null | undefined>,
  inputName: string,
  outputKey: string
): ComputedRef<BoundingBoxInput[] | undefined> {
  const nodeOutputStore = useNodeOutputStore()

  return computed(() => {
    const target = node.value
    if (!target) return undefined

    const slot = target.findInputSlot(inputName)
    if (slot < 0 || !target.isInputConnected(slot)) return undefined

    const incoming = nodeOutputStore.getNodeOutputs(target)?.[outputKey]
    return Array.isArray(incoming) && incoming.every(isBoundingBox)
      ? incoming
      : undefined
  })
}
