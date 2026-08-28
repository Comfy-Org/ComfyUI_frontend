<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const COLS = 12
const ROWS = 6
const STREAM_COLS = COLS + 1
const STREAM_STEP_DURATION = 1100
const LINE_START = 11.5
const LINE_END = 95
const REQUEST_DURATION = 3200
const RESPONSE_DURATION = 2500
const CYCLE_DURATION = 17_000
const REQUEST_STARTS = [900, 6200, 7100, 8000]

interface ActivityCell {
  id: number
  level: number
}

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)

const frameTime = computed(() => elapsed.value % CYCLE_DURATION)
const streamStep = computed(() =>
  Math.floor(elapsed.value / STREAM_STEP_DURATION)
)
const streamProgress = computed(
  () => (elapsed.value % STREAM_STEP_DURATION) / STREAM_STEP_DURATION
)

function activityLevel(column: number, row: number): number {
  const wave = Math.sin(column * 12.9898 + row * 78.233) * 43758.5453
  const sample = wave - Math.floor(wave)

  if (sample < 0.38) return 0
  if (sample < 0.62) return 1
  if (sample < 0.82) return 2
  if (sample < 0.95) return 3
  return 4
}

const activityCells = computed<ActivityCell[]>(() =>
  Array.from({ length: STREAM_COLS * ROWS }, (_, id) => {
    const displayColumn = id % STREAM_COLS
    const row = Math.floor(id / STREAM_COLS)
    const historyColumn = streamStep.value - COLS + displayColumn

    return {
      id,
      level: activityLevel(historyColumn, row)
    }
  })
)

const activityTrackStyle = computed(() => ({
  gridTemplateColumns: `repeat(${STREAM_COLS}, minmax(0, 1fr))`,
  transform: `translate3d(-${(streamProgress.value * 100) / STREAM_COLS}%, 0, 0)`,
  width: `${(STREAM_COLS / COLS) * 100}%`
}))

const pulses = computed(() =>
  REQUEST_STARTS.flatMap((start, id) => {
    const age = frameTime.value - start
    if (age < 0 || age > REQUEST_DURATION + RESPONSE_DURATION) return []

    const progress =
      age <= REQUEST_DURATION
        ? age / REQUEST_DURATION
        : 1 - (age - REQUEST_DURATION) / RESPONSE_DURATION

    return [{ id, position: LINE_START + progress * (LINE_END - LINE_START) }]
  })
)

const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed.value += delta
  },
  { immediate: false }
)

watch(
  onScreen,
  (visible) => {
    if (visible && !prefersReducedMotion()) resume()
    else pause()
  },
  { immediate: true }
)
</script>

<template>
  <div
    ref="stageRef"
    role="img"
    :aria-label="t('platform.serverlessVisual.ariaLabel', locale)"
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl border border-white/10 bg-primary-comfy-ink/60 font-mono"
  >
    <div class="absolute top-[47%] left-[6%] z-10 -translate-y-1/2 text-center">
      <span
        class="bg-primary-comfy-yellow mx-auto mb-3 block size-5.5 rounded-full"
      />
      <span
        class="text-primary-comfy-yellow block text-[8px]/relaxed tracking-widest uppercase sm:text-[9px] lg:text-[10px]"
      >
        {{ t('platform.serverlessVisual.client', locale) }}
      </span>
    </div>

    <div
      class="absolute top-[47%] right-[5%] left-[11.5%] border-t-2 border-dashed border-white/15"
      aria-hidden="true"
    />

    <div
      class="absolute top-[9%] right-[5%] bottom-[20%] left-[22%] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="grid h-full grid-rows-6 gap-1 will-change-transform sm:gap-1.5"
        :style="activityTrackStyle"
      >
        <span
          v-for="cell in activityCells"
          :key="cell.id"
          :class="
            cn(
              'rounded-md transition-[background-color,box-shadow,filter] duration-500',
              cell.level === 0 && 'bg-white/8',
              cell.level === 1 && 'bg-primary-comfy-plum/30',
              cell.level === 2 && 'bg-secondary-mauve/40',
              cell.level === 3 && 'bg-primary-comfy-yellow/55',
              cell.level === 4 &&
                'bg-primary-comfy-yellow shadow-primary-comfy-yellow/30 shadow-md'
            )
          "
        />
      </div>
    </div>

    <span
      v-for="pulse in pulses"
      :key="pulse.id"
      class="shadow-primary-comfy-yellow/80 absolute top-[47%] z-20 size-2.5 -translate-1/2 rounded-full bg-primary-warm-white shadow-lg"
      :style="{ left: `${pulse.position}%` }"
      aria-hidden="true"
    />

    <div
      class="text-primary-comfy-yellow absolute right-[5%] bottom-[9%] left-[22%] flex justify-between gap-1 text-[7px] tracking-widest uppercase sm:gap-2 sm:text-[9px] lg:gap-4 lg:text-[10px]"
    >
      <span>{{ t('platform.serverlessVisual.gateway', locale) }}</span>
      <span>{{ t('platform.serverlessVisual.functions', locale) }}</span>
      <span class="text-right">
        {{ t('platform.serverlessVisual.database', locale) }}
      </span>
    </div>
  </div>
</template>
