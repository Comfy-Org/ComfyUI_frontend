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
const LINE_START = 11.5
const LINE_END = 95
const GRID_START = 22
const REQUEST_DURATION = 3200
const RESPONSE_DURATION = 2500
const ACTIVE_DURATION = 3600
const HOT_DURATION = 850
const CYCLE_DURATION = 17_000
const REQUEST_STARTS = [900, 6200, 7100, 8000]

type CellState = 'idle' | 'on' | 'hot'

interface Cell {
  id: number
  col: number
  row: number
  tone: string
}

const tones = [
  'bg-white/10',
  'bg-secondary-mauve/35',
  'bg-white/15',
  'bg-primary-comfy-plum/30'
]

const cells: Cell[] = Array.from({ length: COLS * ROWS }, (_, id) => ({
  id,
  col: id % COLS,
  row: Math.floor(id / COLS),
  tone: tones[(id * 7 + Math.floor(id / COLS) * 3) % tones.length]
}))

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)

const frameTime = computed(() => elapsed.value % CYCLE_DURATION)

function columnArrival(col: number): number {
  const gridWidth = LINE_END - GRID_START
  const center = GRID_START + (gridWidth / COLS) * (col + 0.5)
  return ((center - LINE_START) / (LINE_END - LINE_START)) * REQUEST_DURATION
}

function wakesCell(cell: Cell, requestIndex: number): boolean {
  const primaryRow = (cell.col * 2 + requestIndex * 3) % ROWS
  const secondaryRow = (primaryRow + 3) % ROWS
  return (
    cell.row === primaryRow ||
    (requestIndex >= 2 &&
      cell.col >= 2 &&
      cell.col < 10 &&
      (cell.col + requestIndex) % 2 === 0 &&
      cell.row === secondaryRow)
  )
}

function stateForCell(cell: Cell, now: number): CellState {
  let state: CellState = 'idle'

  for (const [requestIndex, start] of REQUEST_STARTS.entries()) {
    const age = now - start - columnArrival(cell.col)
    if (age < 0 || age >= ACTIVE_DURATION || !wakesCell(cell, requestIndex)) {
      continue
    }

    if (age < HOT_DURATION && cell.col > 3 && cell.col < 9) return 'hot'
    state = 'on'
  }

  return state
}

const visualCells = computed(() =>
  cells.map((cell) => ({
    ...cell,
    state: stateForCell(cell, frameTime.value)
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
    class="bg-primary-comfy-ink/60 relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl border border-white/10 font-mono"
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
            cell.state === 'on' &&
              'bg-primary-comfy-yellow shadow-md shadow-primary-comfy-yellow/30',
            cell.state === 'hot' &&
              'bg-primary-warm-white shadow-lg shadow-primary-comfy-yellow/60 brightness-110'
          )
        "
      />
    </div>

    <span
      v-for="pulse in pulses"
      :key="pulse.id"
      class="bg-primary-warm-white absolute top-[47%] z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg shadow-primary-comfy-yellow/80"
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
