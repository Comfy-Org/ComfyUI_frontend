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
const CYCLE_DURATION =
  (CELL_COUNT + TRAIL_LENGTH) * CELL_STEP_DURATION + REST_DURATION
const CELL_OPACITIES = [
  0.68, 0.98, 0.37, 1, 0.9, 0.13, 0.74, 0.44, 0.22, 0.21, 0.13, 0.61, 0.48,
  0.91, 0.51, 0.96, 0.97, 0.17, 0.89, 0.61, 0.15, 0.35, 0.19, 0.46, 0.3, 0.8,
  0.66, 0.85, 1, 0.25, 0.98, 0.77, 0.12, 0.54, 0.29, 0.33, 0.3, 0.8, 0.66, 0.85,
  1, 0.25, 0.98, 0.77, 0.12, 0.54, 0.29, 0.33, 0.48, 0.91, 0.51, 0.96, 0.97,
  0.17, 0.89, 0.61, 0.15, 0.35, 0.19, 0.46, 0.68, 0.98, 0.37, 1, 0.9, 0.13,
  0.74, 0.44, 0.22, 0.21, 0.13, 0.61
]

type CellState = 'idle' | 'trail' | 'hot'

interface ActivityCell {
  id: number
  column: number
  row: number
  sequence: number
  opacity: number
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
      sequence: (COLS - 1 - column) * ROWS + (ROWS - 1 - row),
      opacity: CELL_OPACITIES[id]
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
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink font-mono"
  >
    <img
      src="/assets/platform/serverless/local-node.svg"
      alt=""
      class="absolute top-1/2 left-[max(9%,3.75rem)] z-10 size-24 -translate-1/2 sm:size-28"
      aria-hidden="true"
    />

    <img
      src="/assets/platform/serverless/input-line.svg"
      alt=""
      class="absolute top-1/2 left-1/8 h-px w-1/6 -translate-y-1/2"
      aria-hidden="true"
    />

    <div
      class="absolute top-[13%] right-[5%] bottom-[14%] left-3/10 grid grid-cols-12 grid-rows-6 gap-1.5 sm:gap-2"
      aria-hidden="true"
    >
      <span
        v-for="cell in visualCells"
        :key="cell.id"
        :class="
          cn(
            'bg-primary-comfy-yellow rounded-sm transition-[opacity,box-shadow] duration-150',
            cell.state === 'trail' &&
              'shadow-primary-comfy-yellow/15 shadow-sm',
            cell.state === 'hot' &&
              'bg-primary-comfy-yellow shadow-primary-comfy-yellow/35 shadow-md'
          )
        "
        :style="{
          opacity:
            cell.state === 'idle'
              ? cell.opacity
              : cell.state === 'trail'
                ? 0.72
                : 1
        }"
      />
    </div>

    <div
      class="text-primary-comfy-yellow/80 absolute right-[5%] bottom-[6%] left-3/10 grid grid-cols-3 text-[7px] tracking-widest uppercase sm:text-[9px] lg:text-[10px]"
    >
      <span>{{ t('platform.serverlessVisual.worker', locale) }}</span>
      <span class="text-center">
        {{ t('platform.serverlessVisual.worker', locale) }}
      </span>
      <span class="text-right">
        {{ t('platform.serverlessVisual.worker', locale) }}
      </span>
    </div>
  </div>
</template>
