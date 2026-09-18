<script setup lang="ts">
import { Info } from '@lucide/vue'
import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type {
  FrameSize,
  FrameSource
} from '../../config/workshop-model-restrictions'
import { framesDisagreeOnRatio } from '../../config/workshop-model-restrictions'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  first,
  last,
  locale = 'en'
} = defineProps<{
  first?: FrameSource
  last?: FrameSource
  locale?: Locale
}>()

// The server has no decoder, so the frames are measured once the page is live
// and the notice simply does not exist in the rendered HTML.
const mounted = useMounted()
const firstUrl = useObjectUrl(() => (mounted.value ? first?.file : undefined))
const lastUrl = useObjectUrl(() => (mounted.value ? last?.file : undefined))

function useFrameSize(source: () => string | undefined) {
  const size = ref<FrameSize>()
  let generation = 0
  watch(
    source,
    (url) => {
      const measuring = ++generation
      size.value = undefined
      if (!url) return
      const image = new Image()
      image.onload = () => {
        if (measuring !== generation) return
        size.value = { width: image.naturalWidth, height: image.naturalHeight }
      }
      image.src = url
    },
    { immediate: true }
  )
  return size
}

// Reading `mounted` here rather than inside the watcher is what re-runs it once
// the page is live: a frame carrying a plain URL has the same source before and
// after hydration, so a guard inside would skip it and never look again.
const firstSize = useFrameSize(() =>
  mounted.value ? (firstUrl.value ?? first?.url) : undefined
)
const lastSize = useFrameSize(() =>
  mounted.value ? (lastUrl.value ?? last?.url) : undefined
)

// A frame that cannot be decoded leaves its size unset, and an unmeasured pair
// says nothing about its ratios, so the notice stays quiet rather than guessing.
const shown = computed(() =>
  framesDisagreeOnRatio(firstSize.value, lastSize.value)
)
</script>

<template>
  <p
    v-if="shown"
    role="status"
    data-testid="frame-ratio-notice"
    class="flex items-start gap-2 text-xs text-primary-warm-gray"
  >
    <Info class="mt-px size-4 shrink-0" aria-hidden="true" />
    {{ t('workshop.field.frameRatioMismatch', locale) }}
  </p>
</template>
