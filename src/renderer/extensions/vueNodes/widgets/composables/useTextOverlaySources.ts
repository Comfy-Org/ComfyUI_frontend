import { computed, shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { savedImageUrls } from '@/renderer/extensions/vueNodes/widgets/utils/savedImageUrls'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { resolveInputSourceNode } from '@/utils/graphTraversalUtil'

const IMAGES_INPUT = 'images'
const SOURCE_OUTPUT = 'source_images'

export function useTextOverlaySources(
  node: ComputedRef<LGraphNode | null | undefined>
): {
  sourceUrl: ComputedRef<string | undefined>
} {
  const nodeOutputStore = useNodeOutputStore()

  const imagesSource = computed(() => {
    const target = node.value
    if (!target) return undefined

    const slot = target.findInputSlot(IMAGES_INPUT)
    if (slot < 0 || !target.isInputConnected(slot)) return undefined

    return resolveInputSourceNode(target, slot)
  })

  const savedSource = computed(() => {
    const target = node.value
    return target
      ? nodeOutputStore.getNodeOutputs(target)?.[SOURCE_OUTPUT]
      : undefined
  })

  const savedSourceNode = shallowRef(imagesSource.value)
  watch(
    savedSource,
    () => {
      savedSourceNode.value = imagesSource.value
    },
    { flush: 'sync' }
  )

  const sourceUrl = computed(() => {
    const source = imagesSource.value
    if (!source) return undefined

    const upstream = nodeOutputStore.getNodeImageUrls(source)?.[0]
    if (upstream) return upstream

    return savedSourceNode.value === source
      ? savedImageUrls(savedSource.value)[0]
      : undefined
  })

  return { sourceUrl }
}
