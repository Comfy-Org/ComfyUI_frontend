<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { ARTWORKS } from './serverlessArtworks'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const COLS = 36
const ROWS = 14
const CELL_COUNT = COLS * ROWS
const SEND_DURATION = 850
const BUILD_DURATION = 550
const HOLD_DURATION = 1300
const CLEAR_DURATION = 500
const ARTWORK_DURATION =
  SEND_DURATION + BUILD_DURATION + HOLD_DURATION + CLEAR_DURATION
const IDLE_CELL_COLOR =
  'color-mix(in srgb, var(--color-primary-comfy-yellow) 22%, var(--color-primary-comfy-ink))'
const ACTIVE_CELL_COLOR = 'var(--color-primary-comfy-yellow)'

interface HeatmapCell {
  id: number
  column: number
  row: number
  x: number
  y: number
}

const CYCLE_DURATION = ARTWORKS.length * ARTWORK_DURATION
const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)
const reducedMotion = prefersReducedMotion()
const heatmapCells: HeatmapCell[] = Array.from(
  { length: CELL_COUNT },
  (_, id) => {
    const column = id % COLS
    const row = Math.floor(id / COLS)

    return {
      id,
      column,
      row,
      x: (column / (COLS - 1)) * 2 - 1,
      y: (row / (ROWS - 1)) * 2 - 1
    }
  }
)

const frameTime = computed(() =>
  reducedMotion
    ? SEND_DURATION + BUILD_DURATION
    : elapsed.value % CYCLE_DURATION
)
const artworkIndex = computed(() =>
  Math.floor(frameTime.value / ARTWORK_DURATION)
)
const artworkTime = computed(() => frameTime.value % ARTWORK_DURATION)
const currentArtwork = computed(() => ARTWORKS[artworkIndex.value])
const buildProgress = computed(() => {
  if (reducedMotion) return 1
  if (artworkTime.value < SEND_DURATION) return 0
  if (artworkTime.value >= SEND_DURATION + BUILD_DURATION) return 1

  return (artworkTime.value - SEND_DURATION) / BUILD_DURATION
})
const clearStart = SEND_DURATION + BUILD_DURATION + HOLD_DURATION
const isClear = computed(
  () => !reducedMotion && artworkTime.value >= clearStart
)
const connectionProgress = computed(() => {
  if (reducedMotion) return 1
  if (isClear.value) return 0
  return Math.min(1, artworkTime.value / SEND_DURATION)
})
const phase = computed(() => {
  if (reducedMotion) return 'hold'
  if (artworkTime.value < SEND_DURATION) return 'connect'
  if (artworkTime.value < SEND_DURATION + BUILD_DURATION) return 'build'
  if (artworkTime.value < clearStart) return 'hold'
  return 'off'
})

function randomRevealOrder(cell: HeatmapCell) {
  const seed =
    cell.id * 73 + artworkIndex.value * 109 + cell.row * 31 + cell.column * 17
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

const visualCells = computed(() =>
  heatmapCells.map((cell) => {
    const artworkIntensity = currentArtwork.value.pixel(cell.x, cell.y)
    const isRevealed = buildProgress.value >= randomRevealOrder(cell)
    const isActive = artworkIntensity > 0 && isRevealed && !isClear.value

    return {
      ...cell,
      color: isActive ? ACTIVE_CELL_COLOR : IDLE_CELL_COLOR
    }
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
    :data-artwork="currentArtwork.id"
    :data-phase="phase"
    :data-connection-progress="connectionProgress"
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink font-mono"
  >
    <div
      class="absolute top-1/2 left-[max(9%,3.75rem)] z-10 size-12 -translate-1/2 sm:size-14"
      aria-hidden="true"
    >
      <img
        src="/assets/platform/serverless/local-node.svg"
        alt=""
        class="relative z-10 size-full"
      />
    </div>

    <div
      class="absolute top-1/2 left-[14%] h-px w-[16%] -translate-y-1/2"
      aria-hidden="true"
    >
      <span
        class="bg-primary-comfy-yellow absolute inset-y-0 left-0"
        :style="{ width: `${connectionProgress * 100}%` }"
      />
    </div>

    <div
      class="absolute top-1/2 right-[5%] left-3/10 grid -translate-y-1/2 gap-0.5 sm:gap-[3px]"
      aria-hidden="true"
      :style="{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }"
    >
      <span
        v-for="cell in visualCells"
        :key="cell.id"
        data-testid="heatmap-cell"
        class="aspect-square rounded-[2px]"
        :style="{ backgroundColor: cell.color }"
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
