<script setup lang="ts">
import { Scissors } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SwapWindow } from '@/lib/workshop/openjutsu/clip'

/** Which part of the clip the next run swaps, with the way back to the trim dialog. */
const {
  part,
  clipSeconds,
  locale = 'en'
} = defineProps<{
  part: SwapWindow
  clipSeconds: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ trim: [] }>()
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-3"
    data-testid="openjutsu-part"
  >
    <p class="text-sm text-primary-comfy-canvas">
      {{
        t('openjutsu.trim.summary', {
          from: part.start.toFixed(1),
          to: (part.start + part.seconds).toFixed(1),
          seconds: part.seconds.toFixed(1),
          total: clipSeconds.toFixed(1)
        })
      }}
    </p>
    <button
      type="button"
      class="flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-primary-warm-white ring-1 ring-transparency-white-t20 transition-colors ring-inset hover:bg-transparency-white-t8"
      @click="emit('trim')"
    >
      <Scissors class="size-3.5" aria-hidden="true" />
      {{ t('openjutsu.trim.edit') }}
    </button>
  </div>
</template>
