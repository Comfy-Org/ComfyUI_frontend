<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const COLS = 12
const ROWS = 5
const TILE_SIZE = 34
const ISO_X = 0.866025
const ISO_Y = 0.5
const TILE_WIDTH = TILE_SIZE * ISO_X * 2
const TILE_HEIGHT = TILE_SIZE * ISO_Y * 2
const GRID_STEP_X = 35
const GRID_STEP_Y = 18.5
const ORIGIN_X = 235
const ORIGIN_Y = 60
const MAX_HEIGHT = 138
const BUILD_DURATION = 1800
const HOLD_DURATION = 3000
const RESET_DURATION = 650
const CYCLE_DURATION = BUILD_DURATION + HOLD_DURATION + RESET_DURATION
const BUILD_STAGGER = 0.62
const PEAK_COUNT = 4

interface Tile {
  id: number
  column: number
  row: number
  revealOrder: number
  x: number
  y: number
}

interface VisualTile extends Tile {
  height: number
  topFill: string
}

type Point = readonly [number, number]

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(stageRef)
const elapsed = ref(0)
const reducedMotion = prefersReducedMotion()

function mixedColor(token: string, percentage: number) {
  return `color-mix(in srgb, var(${token}) ${percentage}%, var(--color-primary-comfy-ink))`
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3)
}

function easeInCubic(value: number) {
  return value * value * value
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

const tiles: Tile[] = Array.from({ length: COLS * ROWS }, (_, id) => {
  const column = id % COLS
  const row = Math.floor(id / COLS)

  return {
    id,
    column,
    row,
    revealOrder:
      (column / (COLS - 1)) * 0.64 + ((ROWS - 1 - row) / (ROWS - 1)) * 0.36,
    x: ORIGIN_X + (column - row) * GRID_STEP_X,
    y: ORIGIN_Y + (column + row) * GRID_STEP_Y
  }
}).sort((a, b) => a.y - b.y || a.x - b.x)

function patternHeight(tile: Tile, pattern: number) {
  const x = tile.column / (COLS - 1)
  const y = tile.row / (ROWS - 1)
  let field = 0

  for (let peak = 0; peak < PEAK_COUNT; peak += 1) {
    const seed = pattern * 97 + peak * 17
    const centerX = 0.12 + seededUnit(seed + 1) * 0.76
    const centerY = 0.08 + seededUnit(seed + 2) * 0.84
    const spreadX = 0.12 + seededUnit(seed + 3) * 0.2
    const spreadY = 0.2 + seededUnit(seed + 4) * 0.32
    const amplitude = 0.62 + seededUnit(seed + 5) * 0.38
    const distance =
      Math.pow((x - centerX) / spreadX, 2) +
      Math.pow((y - centerY) / spreadY, 2)

    field = Math.max(field, Math.exp(-distance * 0.7) * amplitude)
  }

  const edgeTaper =
    0.68 +
    Math.sin((Math.PI * (tile.column + 0.5)) / COLS) *
      Math.sin((Math.PI * (tile.row + 0.5)) / ROWS) *
      0.32
  const variation = 0.72 + seededUnit(pattern * 131 + tile.id * 11) * 0.56
  const height = Math.round(field * edgeTaper * variation * MAX_HEIGHT)

  return height < 14 ? 0 : Math.min(MAX_HEIGHT, height)
}

const patternIndex = computed(() =>
  reducedMotion ? 0 : Math.floor(elapsed.value / CYCLE_DURATION)
)
const frameTime = computed(() =>
  reducedMotion ? BUILD_DURATION : elapsed.value % CYCLE_DURATION
)
const buildProgress = computed(() => clamp(frameTime.value / BUILD_DURATION))
const resetProgress = computed(() =>
  clamp((frameTime.value - BUILD_DURATION - HOLD_DURATION) / RESET_DURATION)
)
const phase = computed(() => {
  if (reducedMotion || frameTime.value < BUILD_DURATION) return 'grow'
  if (frameTime.value < BUILD_DURATION + HOLD_DURATION) return 'hold'
  return 'reset'
})
const targetHeights = computed(() =>
  tiles.reduce<number[]>((heights, tile) => {
    heights[tile.id] = patternHeight(tile, patternIndex.value)
    return heights
  }, [])
)
const visualTiles = computed<VisualTile[]>(() =>
  tiles.map((tile) => {
    const targetHeight = targetHeights.value[tile.id]
    const localBuildProgress = easeOutCubic(
      clamp(
        (buildProgress.value - tile.revealOrder * BUILD_STAGGER) /
          (1 - BUILD_STAGGER)
      )
    )
    const visibleProgress =
      phase.value === 'grow'
        ? localBuildProgress
        : phase.value === 'hold'
          ? 1
          : 1 - easeInCubic(resetProgress.value)
    const height = targetHeight * visibleProgress
    const level = targetHeight / MAX_HEIGHT

    return {
      ...tile,
      height,
      topFill:
        height > 0.5
          ? mixedColor('--color-primary-comfy-yellow', 76 + level * 24)
          : mixedColor(
              '--color-primary-comfy-plum',
              48 + ((tile.id * 29) % 7) * 5
            )
    }
  })
)

function tileTransform(tile: VisualTile) {
  return `matrix(${ISO_X} ${-ISO_Y} ${ISO_X} ${ISO_Y} ${tile.x} ${tile.y - tile.height})`
}

function tileCorners(tile: VisualTile, elevation: number): readonly Point[] {
  const topY = tile.y - elevation
  const halfWidth = TILE_WIDTH / 2
  const halfHeight = TILE_HEIGHT / 2

  return [
    [tile.x, topY],
    [tile.x + halfWidth, topY - halfHeight],
    [tile.x + TILE_WIDTH, topY],
    [tile.x + halfWidth, topY + halfHeight]
  ]
}

function polygonPoints(points: readonly Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

function leftFace(tile: VisualTile) {
  const top = tileCorners(tile, tile.height)
  const base = tileCorners(tile, 0)

  return polygonPoints([top[0], top[3], base[3], base[0]])
}

function rightFace(tile: VisualTile) {
  const top = tileCorners(tile, tile.height)
  const base = tileCorners(tile, 0)

  return polygonPoints([top[3], top[2], base[2], base[3]])
}

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
    :data-pattern="patternIndex"
    :data-phase="phase"
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink"
  >
    <svg
      viewBox="0 0 760 360"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <defs>
        <clipPath
          v-for="tile in visualTiles"
          :id="`isometric-body-${tile.id}`"
          :key="tile.id"
          clipPathUnits="userSpaceOnUse"
        >
          <polygon :points="leftFace(tile)" />
          <polygon :points="rightFace(tile)" />
        </clipPath>
      </defs>

      <g v-for="tile in visualTiles" :key="tile.id">
        <image
          v-if="tile.height > 0.5"
          href="/assets/platform/serverless/isometric-texture.webp"
          :x="tile.x"
          :y="tile.y - tile.height"
          :width="TILE_WIDTH"
          :height="tile.height + TILE_HEIGHT / 2"
          :clip-path="`url(#isometric-body-${tile.id})`"
          preserveAspectRatio="none"
        />
        <template v-if="tile.height > 0.5">
          <polygon
            :points="leftFace(tile)"
            fill="var(--color-primary-comfy-ink)"
            fill-opacity="0.12"
          />
          <polygon
            :points="rightFace(tile)"
            fill="var(--color-primary-comfy-plum)"
            fill-opacity="0.06"
          />
        </template>
        <rect
          :width="TILE_SIZE"
          :height="TILE_SIZE"
          rx="5"
          :transform="tileTransform(tile)"
          :fill="tile.topFill"
        />
      </g>
    </svg>
  </div>
</template>
