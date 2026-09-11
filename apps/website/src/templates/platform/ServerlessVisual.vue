<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// GPU classes the fleet runs on, one label per column of the worker grid.
const GPUS = ['RTX 6000 PRO', 'H100', 'B200']

const COLS = 12
const ROWS = 5
const CELL_COUNT = COLS * ROWS
const CELL_STEP_DURATION = 140
const REST_DURATION = 0
const LINE_PULSE_DURATION = 1800
// 3x5 pixel glyphs spelling COMFYUI, scrolled across the worker grid.
const LETTER_PATTERNS = [
  ['111', '100', '100', '100', '111'],
  ['111', '101', '101', '101', '111'],
  ['101', '111', '111', '101', '101'],
  ['111', '100', '110', '100', '100'],
  ['101', '101', '010', '010', '010'],
  ['101', '101', '101', '101', '111'],
  ['111', '010', '010', '010', '111']
]
const WORD_WIDTH = LETTER_PATTERNS.length * 4 - 1
const MARQUEE_STEPS = WORD_WIDTH + COLS
const CYCLE_DURATION = MARQUEE_STEPS * CELL_STEP_DURATION + REST_DURATION
const CELL_OPACITIES = [
  0.68, 0.98, 0.37, 1, 0.9, 0.13, 0.74, 0.44, 0.22, 0.21, 0.13, 0.61, 0.48,
  0.91, 0.51, 0.96, 0.97, 0.17, 0.89, 0.61, 0.15, 0.35, 0.19, 0.46, 0.3, 0.8,
  0.66, 0.85, 1, 0.25, 0.98, 0.77, 0.12, 0.54, 0.29, 0.33, 0.3, 0.8, 0.66, 0.85,
  1, 0.25, 0.98, 0.77, 0.12, 0.54, 0.29, 0.33, 0.48, 0.91, 0.51, 0.96, 0.97,
  0.17, 0.89, 0.61, 0.15, 0.35, 0.19, 0.46, 0.68, 0.98, 0.37, 1, 0.9, 0.13,
  0.74, 0.44, 0.22, 0.21, 0.13, 0.61
]

const wordCells = new Set(
  LETTER_PATTERNS.flatMap((pattern, letterIndex) =>
    pattern.flatMap((row, rowIndex) =>
      [...row].flatMap((value, pixelIndex) =>
        value === '1'
          ? [rowIndex * WORD_WIDTH + letterIndex * 4 + pixelIndex]
          : []
      )
    )
  )
)

type CellState = 'idle' | 'hot'

interface ActivityCell {
  id: number
  column: number
  row: number
  opacity: number
}

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)
const reducedMotion = prefersReducedMotion()

const frameTime = computed(() => elapsed.value % CYCLE_DURATION)
const linePulseProgress = computed(() =>
  reducedMotion
    ? 1
    : (elapsed.value % LINE_PULSE_DURATION) / LINE_PULSE_DURATION
)
const activityCells: ActivityCell[] = Array.from(
  { length: CELL_COUNT },
  (_, id) => {
    const column = id % COLS
    const row = Math.floor(id / COLS)

    return {
      id,
      column,
      row,
      opacity: CELL_OPACITIES[id]
    }
  }
)

function cellState(cell: ActivityCell, now: number): CellState {
  const marqueeOffset = reducedMotion
    ? 0
    : Math.floor(now / CELL_STEP_DURATION) - WORD_WIDTH
  const sourceColumn = cell.column - marqueeOffset

  if (sourceColumn < 0 || sourceColumn >= WORD_WIDTH) return 'idle'

  return wordCells.has(cell.row * WORD_WIDTH + sourceColumn) ? 'hot' : 'idle'
}

const visualCells = computed(() =>
  activityCells.map((cell) => ({
    ...cell,
    state: cellState(cell, frameTime.value)
  }))
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
    if (visible && !reducedMotion) resume()
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
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink font-mono"
  >
    <div
      class="absolute top-1/2 left-[max(9%,3.75rem)] z-10 size-24 -translate-1/2 sm:size-28"
      aria-hidden="true"
    >
      <img
        src="/assets/platform/serverless/local-node.svg"
        alt=""
        class="relative z-10 size-full"
      />
    </div>

    <div
      class="bg-primary-comfy-plum absolute top-1/2 left-[14%] h-px w-[16%] -translate-y-1/2"
      aria-hidden="true"
    >
      <span
        class="bg-primary-comfy-yellow absolute top-1/2 size-2 -translate-1/2 rounded-full"
        :style="{
          left: `${linePulseProgress * 100}%`,
          opacity: linePulseProgress < 0.08 || linePulseProgress > 0.92 ? 0 : 1
        }"
      />
    </div>

    <div
      class="absolute inset-y-[18%] right-[5%] left-3/10 grid grid-cols-12 grid-rows-5 gap-1.5 sm:gap-2"
      aria-hidden="true"
    >
      <span
        v-for="cell in visualCells"
        :key="cell.id"
        class="bg-primary-comfy-yellow rounded-sm transition-opacity duration-300"
        :style="{
          opacity: cell.state === 'idle' ? 0.14 + cell.opacity * 0.16 : 0.62
        }"
      />
    </div>

    <div
      class="text-primary-comfy-yellow/80 absolute right-[5%] bottom-[6%] left-3/10 grid grid-cols-3 text-[7px] tracking-widest uppercase sm:text-[9px] lg:text-[10px]"
    >
      <span
        v-for="(gpu, index) in GPUS"
        :key="gpu"
        :class="cn(index === 1 && 'text-center', index === 2 && 'text-right')"
      >
        {{ gpu }}
      </span>
    </div>
  </div>
</template>
