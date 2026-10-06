<script setup lang="ts">
import { Loader2 } from '@lucide/vue'

import type { Modality } from '@/config/models-catalogue'
import type { RunState } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  run,
  elapsed,
  modality,
  locale = 'en'
} = defineProps<{
  run: Extract<RunState, { status: 'running' }>
  elapsed: string
  modality?: Modality
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <Loader2
      v-if="!run.stalled"
      class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
      data-testid="run-spinner"
    />
    <p class="flex items-baseline gap-2 text-sm text-primary-warm-white">
      {{ run.label ?? t('workshop.run.running') }}
      <span
        v-if="!run.stalled"
        class="text-primary-warm-gray tabular-nums"
        data-testid="run-elapsed"
      >
        {{ elapsed }}
      </span>
    </p>
    <p
      v-if="modality === 'video' && run.label === undefined"
      class="max-w-xs text-xs text-primary-warm-gray"
    >
      {{ t('workshop.run.videoHint') }}
    </p>
  </div>
</template>
