<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const COLS = 36
const ROWS = 14
const CELL_COUNT = COLS * ROWS
const SEND_DURATION = 650
const BUILD_DURATION = 2200
const HOLD_DURATION = 1300
const CLEAR_DURATION = 650
const ARTWORK_DURATION =
  SEND_DURATION + BUILD_DURATION + HOLD_DURATION + CLEAR_DURATION
const PACKET_TRAIL_OFFSETS = [0, 0.14, 0.28] as const

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
  idleOpacity: number
  revealOrder: number
  x: number
  y: number
}

interface DataPacket {
  id: number
  opacity: number
  progress: number
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
      idleOpacity: 0.14 + (((id * 43 + 19) % 100) / 100) * 0.2,
      revealOrder:
        (column / (COLS - 1)) * 0.64 + ((ROWS - 1 - row) / (ROWS - 1)) * 0.36,
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
const isSending = computed(
  () => !reducedMotion && artworkTime.value < SEND_DURATION
)
const buildProgress = computed(() => {
  if (reducedMotion) return 1
  if (artworkTime.value < SEND_DURATION) return 0
  if (artworkTime.value >= SEND_DURATION + BUILD_DURATION) return 1

  return (artworkTime.value - SEND_DURATION) / BUILD_DURATION
})
const clearProgress = computed(() => {
  const clearStart = SEND_DURATION + BUILD_DURATION + HOLD_DURATION
  if (reducedMotion || artworkTime.value < clearStart) return 0

  return (artworkTime.value - clearStart) / CLEAR_DURATION
})
const packetHeadProgress = computed(() =>
  isSending.value ? artworkTime.value / SEND_DURATION : 0
)
const dataPackets = computed<DataPacket[]>(() =>
  PACKET_TRAIL_OFFSETS.flatMap((offset, id) => {
    const progress = packetHeadProgress.value - offset

    if (!isSending.value || progress <= 0) return []

    const endpointFade = Math.min(1, progress / 0.08, (1 - progress) / 0.08)

    return [
      {
        id,
        progress,
        opacity: Math.max(0, endpointFade) * (1 - id * 0.24)
      }
    ]
  })
)
const visualCells = computed(() =>
  heatmapCells.map((cell) => {
    const artworkIntensity = currentArtwork.value.pixel(cell.x, cell.y)
    const isRevealed = buildProgress.value >= cell.revealOrder
    const activeOpacity = 0.4 + artworkIntensity * 0.6
    const visibleOpacity =
      artworkIntensity > 0 && isRevealed
        ? cell.idleOpacity +
          (activeOpacity - cell.idleOpacity) * (1 - clearProgress.value)
        : cell.idleOpacity

    return {
      ...cell,
      opacity: visibleOpacity,
      isActive: artworkIntensity > 0 && isRevealed,
      isLeading:
        artworkIntensity > 0 &&
        buildProgress.value < 1 &&
        Math.abs(buildProgress.value - cell.revealOrder) < 0.035
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
      class="bg-primary-comfy-plum absolute top-1/2 left-[14%] h-px w-[16%] -translate-y-1/2"
      aria-hidden="true"
    >
      <span
        v-for="packet in dataPackets"
        :key="packet.id"
        class="bg-primary-comfy-yellow absolute top-1/2 size-2 -translate-1/2 rounded-full"
        :style="{
          left: `${packet.progress * 100}%`,
          opacity: packet.opacity
        }"
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
        :class="
          cn(
            'bg-primary-comfy-yellow aspect-square rounded-[2px] transition-[opacity,box-shadow] duration-100',
            cell.isActive && 'shadow-primary-comfy-yellow/20 shadow-sm',
            cell.isLeading && 'shadow-primary-comfy-yellow/45 shadow-md'
          )
        "
        :style="{ opacity: cell.opacity }"
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
