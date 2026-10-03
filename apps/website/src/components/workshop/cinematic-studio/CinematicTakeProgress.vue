<script setup lang="ts">
import { translationsFor } from '../../../i18n/translations'
import { LoaderCircle } from '@lucide/vue'
import { useTimestamp } from '@vueuse/core'
import { computed } from 'vue'

import { formatElapsed } from '../../../config/workshop-run'
import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'

const LONG_WAIT_MS = 30_000

const { take, locale = 'en' } = defineProps<{
  take: Take
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const now = useTimestamp({ interval: 1000 })
const elapsed = computed(() => Math.max(0, now.value - take.startedAt))
</script>

<template>
  <p
    v-if="elapsed >= LONG_WAIT_MS"
    class="absolute inset-x-4 top-4 mx-auto w-fit rounded-full border border-transparency-white-t8 bg-primary-comfy-ink/80 px-3.5 py-2 text-center text-xs text-primary-comfy-canvas"
  >
    {{ t('cinematic.stage.longWait') }}
  </p>
  <figcaption
    role="status"
    class="relative flex flex-col items-center gap-4 p-6 text-center"
  >
    <LoaderCircle
      class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    <span class="flex items-baseline gap-2 text-sm text-primary-warm-white">
      {{
        t('cinematic.stage.renderingTakeName', {
          shot: take.shot,
          take: take.letter
        })
      }}
      <span class="text-primary-warm-gray tabular-nums">
        {{ formatElapsed(elapsed) }}
      </span>
    </span>
  </figcaption>
</template>
