<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { computed } from 'vue'

import type { Modality } from '../../config/models-catalogue'
import { estimatedGenerationProgress } from '../../config/workshop-generation-progress'
import { formatElapsed } from '../../config/workshop-run'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  elapsedMs,
  estimatedSeconds,
  modality,
  locale = 'en'
} = defineProps<{
  elapsedMs: number
  estimatedSeconds?: number
  modality?: Modality
  locale?: Locale
}>()

const progress = computed(() =>
  estimatedSeconds
    ? estimatedGenerationProgress(elapsedMs, estimatedSeconds)
    : 0
)
const percentage = computed(() => Math.round(progress.value))
const estimate = computed(() => {
  const seconds = estimatedSeconds ?? 0
  const short = seconds < 60
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: short ? 'second' : 'minute',
    unitDisplay: 'short',
    maximumFractionDigits: 1
  }).format(short ? seconds : seconds / 60)
})
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <div
      v-if="estimatedSeconds"
      role="progressbar"
      :aria-label="t('workshop.run.estimatedProgress', locale)"
      :aria-valuenow="percentage"
      :aria-valuemin="0"
      :aria-valuemax="100"
      class="relative grid size-24 place-items-center"
    >
      <svg
        class="absolute inset-0 size-full -rotate-90"
        viewBox="0 0 100 100"
        fill="none"
        stroke-width="4"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="currentColor"
          class="text-transparency-white-t10"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          pathLength="100"
          stroke="currentColor"
          stroke-dasharray="100"
          :stroke-dashoffset="100 - progress"
          stroke-linecap="butt"
          class="text-primary-comfy-yellow motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
        />
      </svg>
      <span class="text-xl font-semibold text-primary-warm-white tabular-nums"
        >{{ percentage }}%</span
      >
    </div>
    <Loader2
      v-else
      class="size-8 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    <p class="flex items-baseline gap-2 text-sm text-primary-warm-white">
      {{ t('workshop.run.running', locale) }}
      <span
        class="text-primary-warm-gray tabular-nums"
        data-testid="run-elapsed"
        >{{ formatElapsed(elapsedMs) }}</span
      >
    </p>
    <p v-if="estimatedSeconds" class="text-xs text-primary-warm-gray">
      {{ t('workshop.run.estimatedTime', locale).replace('{time}', estimate) }}
    </p>
    <p
      v-if="estimatedSeconds && elapsedMs > estimatedSeconds * 1000"
      class="max-w-xs text-xs text-primary-warm-gray"
    >
      {{ t('workshop.run.longerThanEstimated', locale) }}
    </p>
    <p
      v-if="modality === 'video'"
      class="max-w-xs text-xs text-primary-warm-gray"
    >
      {{ t('workshop.run.videoHint', locale) }}
    </p>
  </div>
</template>
