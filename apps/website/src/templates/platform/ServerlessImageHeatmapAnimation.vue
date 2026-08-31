<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

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

interface Point {
  x: number
  y: number
}

interface Artwork {
  id: 'anime' | 'dragon' | 'robot' | 'spacecraft'
  pixel: (x: number, y: number) => number
}

interface HeatmapCell {
  id: number
  column: number
  row: number
  x: number
  y: number
}

function inEllipse(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number
) {
  const normalizedX = (x - centerX) / radiusX
  const normalizedY = (y - centerY) / radiusY
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1
}

function triangleArea(a: Point, b: Point, c: Point) {
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2
  )
}

function inTriangle(x: number, y: number, a: Point, b: Point, c: Point) {
  const point = { x, y }
  const area = triangleArea(a, b, c)
  const subAreas =
    triangleArea(point, b, c) +
    triangleArea(a, point, c) +
    triangleArea(a, b, point)

  return Math.abs(area - subAreas) < 0.001
}

function animePixel(x: number, y: number) {
  const outerHair = inEllipse(x, y, 0, -0.08, 0.46, 0.72)
  const face = inEllipse(x, y, 0, -0.01, 0.32, 0.52)
  const leftEye = inEllipse(x, y, -0.13, -0.05, 0.055, 0.07)
  const rightEye = inEllipse(x, y, 0.13, -0.05, 0.055, 0.07)
  const mouth = Math.abs(x) < 0.1 && y > 0.18 && y < 0.25
  const fringe = outerHair && y < -0.12 + Math.sin((x + 0.42) * 17) * 0.08
  const shoulders =
    y > 0.42 && y < 0.92 && Math.abs(x) < 0.7 - (y - 0.42) * 0.26
  const leftHairPoint = inTriangle(
    x,
    y,
    { x: -0.38, y: -0.5 },
    { x: -0.14, y: -0.92 },
    { x: -0.04, y: -0.58 }
  )
  const rightHairPoint = inTriangle(
    x,
    y,
    { x: 0.04, y: -0.58 },
    { x: 0.16, y: -0.92 },
    { x: 0.4, y: -0.5 }
  )

  if (leftEye || rightEye || mouth) return 0
  if (fringe || leftHairPoint || rightHairPoint) return 0.66
  if (face) return 0.94
  if (outerHair) return 0.58
  if (shoulders) return 0.52
  return 0
}

function dragonPixel(x: number, y: number) {
  const bodyLine = 0.12 + Math.sin((x + 0.55) * 4.2) * 0.12
  const body = x > -0.68 && x < 0.62 && Math.abs(y - bodyLine) < 0.11
  const head = inEllipse(x, y, 0.62, -0.04, 0.2, 0.2)
  const snout = x > 0.62 && x < 0.9 && y > -0.05 && y < 0.11
  const eye = inEllipse(x, y, 0.68, -0.09, 0.04, 0.05)
  const leftWing = inTriangle(
    x,
    y,
    { x: -0.26, y: 0.08 },
    { x: -0.58, y: -0.78 },
    { x: 0.02, y: -0.22 }
  )
  const rightWing = inTriangle(
    x,
    y,
    { x: 0.02, y: 0.04 },
    { x: 0.42, y: -0.76 },
    { x: 0.42, y: -0.08 }
  )
  const tail =
    x < -0.5 && x > -0.92 && Math.abs(y - (-0.15 - (x + 0.5) * 1.2)) < 0.08
  const legs =
    ((x > -0.2 && x < -0.08) || (x > 0.22 && x < 0.34)) && y > 0.16 && y < 0.55

  if (eye) return 0
  if (head || snout) return 1
  if (body || tail || legs) return 0.86
  if (leftWing || rightWing) return 0.58
  return 0
}

function robotPixel(x: number, y: number) {
  const head = Math.abs(x) < 0.48 && y > -0.58 && y < 0.3
  const cornerCut = Math.abs(x) > 0.38 && (y < -0.48 || y > 0.2)
  const leftEye = inEllipse(x, y, -0.18, -0.18, 0.09, 0.11)
  const rightEye = inEllipse(x, y, 0.18, -0.18, 0.09, 0.11)
  const mouth = Math.abs(x) < 0.25 && y > 0.08 && y < 0.15
  const antenna = Math.abs(x) < 0.045 && y > -0.82 && y < -0.56
  const antennaTip = inEllipse(x, y, 0, -0.84, 0.08, 0.08)
  const ears = Math.abs(x) > 0.46 && Math.abs(x) < 0.62 && y > -0.3 && y < 0.06
  const torso = y > 0.36 && y < 0.92 && Math.abs(x) < 0.66 - (y - 0.36) * 0.18

  if (leftEye || rightEye || mouth || antennaTip) return 1
  if (antenna || ears) return 0.82
  if (head && !cornerCut) return 0.52
  if (torso) return 0.64
  return 0
}

function spacecraftPixel(x: number, y: number) {
  const fuselage =
    x > -0.62 && x < 0.62 && Math.abs(y) < 0.09 + (x + 0.62) * 0.04
  const nose = inTriangle(
    x,
    y,
    { x: 0.52, y: -0.18 },
    { x: 0.92, y: 0 },
    { x: 0.52, y: 0.18 }
  )
  const upperWing = inTriangle(
    x,
    y,
    { x: -0.24, y: -0.06 },
    { x: 0.24, y: -0.72 },
    { x: 0.38, y: -0.08 }
  )
  const lowerWing = inTriangle(
    x,
    y,
    { x: -0.24, y: 0.06 },
    { x: 0.24, y: 0.72 },
    { x: 0.38, y: 0.08 }
  )
  const cockpit = inEllipse(x, y, 0.34, -0.01, 0.14, 0.1)
  const upperEngine = inEllipse(x, y, -0.66, -0.17, 0.17, 0.11)
  const lowerEngine = inEllipse(x, y, -0.66, 0.17, 0.17, 0.11)

  if (cockpit) return 1
  if (fuselage || nose) return 0.88
  if (upperWing || lowerWing) return 0.62
  if (upperEngine || lowerEngine) return 0.74
  return 0
}

const ARTWORKS: readonly Artwork[] = [
  { id: 'anime', pixel: animePixel },
  { id: 'dragon', pixel: dragonPixel },
  { id: 'robot', pixel: robotPixel },
  { id: 'spacecraft', pixel: spacecraftPixel }
]
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
