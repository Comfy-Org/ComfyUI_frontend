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
const WAVE_START = 700
const WAVE_STEP_DURATION = 240
const WAVE_HOT_DURATION = 420
const WAVE_ACTIVE_DURATION = 1400
const LINE_START = 11.5
const LINE_END = 95
const REQUEST_DURATION = 3200
const RESPONSE_DURATION = 2500
const CYCLE_DURATION = 7200
const REQUEST_STARTS = [500]

type CellState = 'idle' | 'on' | 'hot'

interface ActivityCell {
  id: number
  column: number
  row: number
  tone: string
}

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)

const frameTime = computed(() => elapsed.value % CYCLE_DURATION)

const tones = [
  'bg-white/8',
  'bg-primary-comfy-plum/30',
  'bg-secondary-mauve/35',
  'bg-white/12'
]

const activityCells: ActivityCell[] = Array.from(
  { length: COLS * ROWS },
  (_, id) => {
    const row = Math.floor(id / COLS)

    return {
      id,
      column: id % COLS,
      row,
      tone: tones[(id * 7 + row * 3) % tones.length]
    }
  }
)

function cellState(cell: ActivityCell, now: number): CellState {
  const diagonal = COLS - 1 - cell.column + (ROWS - 1 - cell.row)
  const age = now - WAVE_START - diagonal * WAVE_STEP_DURATION

  if (age < 0 || age >= WAVE_ACTIVE_DURATION) return 'idle'
  if (age < WAVE_HOT_DURATION) return 'hot'
  return 'on'
}

const visualCells = computed(() =>
  activityCells.map((cell) => ({
    ...cell,
    state: cellState(cell, frameTime.value)
  }))
)

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
      class="absolute top-[9%] right-[5%] bottom-[20%] left-[22%] grid grid-cols-12 grid-rows-6 gap-1 sm:gap-1.5"
      aria-hidden="true"
    >
      <span
        v-for="cell in visualCells"
        :key="cell.id"
        :class="
          cn(
            'rounded-md transition-[background-color,box-shadow,filter] duration-300',
            cell.state === 'idle' && cell.tone,
            cell.state === 'on' && 'bg-primary-comfy-yellow/45',
            cell.state === 'hot' &&
              'bg-primary-comfy-yellow shadow-primary-comfy-yellow/35 shadow-md'
          )
        "
      />
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
