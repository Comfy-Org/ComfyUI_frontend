import { useObjectUrl } from '@vueuse/core'
import { computed } from 'vue'

import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import { imageSource } from '../../../lib/workshop/cinematic-studio/take-image'

/** A URL that shows an input: the picture the page holds, or a reused take's link. */
export function useImagePreview(image: () => StudioImage | undefined) {
  const source = computed(() => imageSource(image()))
  const picture = useObjectUrl(() =>
    source.value instanceof Blob ? source.value : undefined
  )
  return computed(() =>
    typeof source.value === 'string' ? source.value : picture.value
  )
}
