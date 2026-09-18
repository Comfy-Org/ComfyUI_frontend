<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue'
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
  <!-- Announced politely, not as an alert: this follows the reader's own
  choice of frame and costs them a better result, never the run. -->
  <div
    v-if="shown"
    role="status"
    data-testid="frame-ratio-notice"
    class="flex items-start gap-3 rounded-2xl border border-primary-comfy-orange/40 bg-primary-comfy-orange/10 p-4 text-sm text-primary-warm-white"
  >
    <AlertTriangle
      class="mt-0.5 size-5 shrink-0 text-primary-comfy-orange"
      aria-hidden="true"
    />
    <div class="flex min-w-0 flex-col gap-1">
      <p class="font-bold">
        {{ t('workshop.field.frameRatioMismatchTitle', locale) }}
      </p>
      <p>{{ t('workshop.field.frameRatioMismatch', locale) }}</p>
    </div>
  </div>
</template>
