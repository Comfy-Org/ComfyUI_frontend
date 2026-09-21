import { useMounted, useObjectUrl } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import type {
  FrameSize,
  FrameSource
} from '../config/workshop-model-restrictions'
import { framesDisagreeOnRatio } from '../config/workshop-model-restrictions'

/**
 * Whether the chosen frames will make the provider stretch the last one.
 *
 * The warning and the frame it points at both read this, so they cannot
 * disagree about which upload is the problem.
 */
export function useFrameRatioMismatch(
  first: () => FrameSource | undefined,
  last: () => FrameSource | undefined
): Readonly<Ref<boolean>> {
  // The server has no decoder, so the frames are measured once the page is
  // live and the warning simply does not exist in the rendered HTML.
  const mounted = useMounted()
  const firstUrl = useObjectUrl(() =>
    mounted.value ? first()?.file : undefined
  )
  const lastUrl = useObjectUrl(() => (mounted.value ? last()?.file : undefined))

  const firstSize = useFrameSize(() =>
    mounted.value ? (firstUrl.value ?? first()?.url) : undefined
  )
  const lastSize = useFrameSize(() =>
    mounted.value ? (lastUrl.value ?? last()?.url) : undefined
  )

  // A frame that cannot be decoded leaves its size unset, and an unmeasured
  // pair says nothing about its ratios, so this stays false rather than
  // guessing.
  return computed(() => framesDisagreeOnRatio(firstSize.value, lastSize.value))
}

function useFrameSize(source: () => string | undefined) {
  const size = ref<FrameSize>()
  watch(
    source,
    (url, _, onCleanup) => {
      size.value = undefined
      if (!url) return
      const image = new Image()
      image.onload = () => {
        size.value = { width: image.naturalWidth, height: image.naturalHeight }
      }
      image.src = url
      // A frame replaced before it decoded must not land its dimensions
      // afterwards, and a stalled one must not hold the closure past unmount.
      onCleanup(() => {
        image.onload = null
      })
    },
    { immediate: true }
  )
  return size
}
