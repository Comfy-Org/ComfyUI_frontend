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
const CELL_COUNT = COLS * ROWS
const CELL_STEP_DURATION = 150
const TRAIL_LENGTH = 3
const REST_DURATION = 1400
const LINE_START = 11.5
const LINE_END = 95
const REQUEST_DURATION = 3200
const RESPONSE_DURATION = 2500
const CYCLE_DURATION =
  (CELL_COUNT + TRAIL_LENGTH) * CELL_STEP_DURATION + REST_DURATION
const REQUEST_STARTS = [400, 6600]

type CellState = 'idle' | 'trail' | 'hot'

interface ActivityCell {
  id: number
  column: number
  row: number
  sequence: number
}

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)

const frameTime = computed(() => elapsed.value % CYCLE_DURATION)

const activityCells: ActivityCell[] = Array.from(
  { length: CELL_COUNT },
  (_, id) => {
    const column = id % COLS
    const row = Math.floor(id / COLS)

    return {
      id,
      column,
      row,
      sequence: (COLS - 1 - column) * ROWS + (ROWS - 1 - row)
    }
  }
)

function cellState(cell: ActivityCell, now: number): CellState {
  const currentSequence = Math.floor(now / CELL_STEP_DURATION)
  const distance = currentSequence - cell.sequence

  if (distance === 0) return 'hot'
  if (distance > 0 && distance <= TRAIL_LENGTH) return 'trail'
  return 'idle'
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
            'rounded-md transition-[background-color,box-shadow] duration-150',
            cell.state === 'idle' && 'bg-primary-comfy-plum/35',
            cell.state === 'trail' && 'bg-secondary-mauve/55',
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
