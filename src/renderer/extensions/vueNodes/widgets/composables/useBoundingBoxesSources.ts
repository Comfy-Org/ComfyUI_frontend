import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { BoundingBoxInput } from '@/composables/boundingBoxes/boundingBoxesUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useIncomingBoundingBoxes } from '@/renderer/extensions/vueNodes/widgets/composables/useIncomingBoundingBoxes'
import { useInputImageSource } from '@/renderer/extensions/vueNodes/widgets/composables/useInputImageSource'

export function useBoundingBoxesSources(
  node: ComputedRef<LGraphNode | null | undefined>
): {
  backgroundConnected: ComputedRef<boolean>
  backgroundUrl: ComputedRef<string | undefined>
  incomingBoxes: ComputedRef<BoundingBoxInput[] | undefined>
} {
  const { connected: backgroundConnected, url: backgroundUrl } =
    useInputImageSource(node, 'background', 'background_images')

  const incoming = useIncomingBoundingBoxes(node, 'bboxes', 'input_bboxes')
  const incomingBoxes = computed(() =>
    incoming.value?.length ? incoming.value : undefined
  )

  return { backgroundConnected, backgroundUrl, incomingBoxes }
}
