import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { isBoundingBox } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { BoundingBoxInput } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { savedImageUrls } from '@/renderer/extensions/vueNodes/widgets/utils/savedImageUrls'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { resolveInputSourceNode } from '@/utils/graphTraversalUtil'

const BACKGROUND_INPUT = 'background'
const BBOXES_INPUT = 'bboxes'
const INCOMING_OUTPUT = 'input_bboxes'
const BACKGROUND_OUTPUT = 'background_images'

export function useBoundingBoxesSources(
  node: ComputedRef<LGraphNode | null | undefined>
): {
  backgroundConnected: ComputedRef<boolean>
  backgroundUrl: ComputedRef<string | undefined>
  incomingBoxes: ComputedRef<BoundingBoxInput[] | undefined>
} {
  const nodeOutputStore = useNodeOutputStore()

  const backgroundConnected = computed(() => {
    const target = node.value
    if (!target) return false

    const slot = target.findInputSlot(BACKGROUND_INPUT)
    return slot >= 0 && target.isInputConnected(slot)
  })

  const backgroundUrl = computed(() => {
    const target = node.value
    if (!target) return undefined

    const slot = target.findInputSlot(BACKGROUND_INPUT)
    if (slot < 0 || !target.isInputConnected(slot)) return undefined

    const source = resolveInputSourceNode(target, slot)
    const upstream = source && nodeOutputStore.getNodeImageUrls(source)?.[0]
    return (
      upstream ||
      savedImageUrls(
        nodeOutputStore.getNodeOutputs(target)?.[BACKGROUND_OUTPUT]
      )[0]
    )
  })

  const incomingBoxes = computed(() => {
    const target = node.value
    if (!target) return undefined

    const slot = target.findInputSlot(BBOXES_INPUT)
    if (slot < 0 || !target.isInputConnected(slot)) return undefined

    const incoming = nodeOutputStore.getNodeOutputs(target)?.[INCOMING_OUTPUT]
    return Array.isArray(incoming) &&
      incoming.length &&
      incoming.every(isBoundingBox)
      ? incoming
      : undefined
  })

  return { backgroundConnected, backgroundUrl, incomingBoxes }
}
