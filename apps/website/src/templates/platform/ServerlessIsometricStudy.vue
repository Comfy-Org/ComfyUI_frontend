<script setup lang="ts">
import {
  useDocumentVisibility,
  useElementVisibility,
  useRafFn
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const COLS = 20
const ROWS = 7
const TILE_SIZE = 20
const ISO_X = 0.866025
const ISO_Y = 0.5
const TILE_WIDTH = TILE_SIZE * ISO_X * 2
const TILE_HEIGHT = TILE_SIZE * ISO_Y * 2
const GRID_STEP_X = 21
const GRID_STEP_Y = 11
const ORIGIN_X = 226
const ORIGIN_Y = 60
const MAX_HEIGHT = 72
const TOP_PADDING = 18
const BUILD_DURATION = 1800
const HOLD_DURATION = 3000
const RESET_DURATION = 650
const CYCLE_DURATION = BUILD_DURATION + HOLD_DURATION + RESET_DURATION
const BUILD_STAGGER = 0.62
const MAX_FACE_SHADE_OPACITY = 0.62
const CONTRIBUTION_HEIGHTS = [0, 14, 26, 40, 56, 72] as const
const STAGE_WIDTH = 760
const STAGE_HEIGHT = 360
const INK_TOKEN = '--color-primary-comfy-ink'
const PLUM_TOKEN = '--color-primary-comfy-plum'
const INDICATOR_STAGE_CENTER = [87, 256] as const

// A 30 fps cap lands exactly on the 60 Hz vsync interval, so jitter defers most
// frames by a whole extra vsync and the cadence collapses to ~22 fps.
const ANIMATION_FPS = 40

// The retired holographic texture, resampled onto the stage as a 7x4 grid.
const SURFACE_FIELD = [
  ['#d7d5e1', '#bcc6e6', '#d5d4e1', '#cbd1e4', '#dbe4f4', '#dee4e9', '#e8eac5'],
  ['#e7dfd5', '#edcacd', '#e5cac5', '#cccfdc', '#d3d2dd', '#e2dae1', '#eee2e6'],
  ['#e4d7d5', '#e8ded7', '#d8d2e1', '#a0c5ee', '#dcd8d2', '#e3d7cf', '#ebe0df'],
  ['#dbdfeb', '#d7d5d9', '#ded7cf', '#cbd0cb', '#b2cddc', '#bcb8dd', '#eddfde']
]

interface Tile {
  id: number
  column: number
  row: number
  revealOrder: number
  x: number
  y: number
  leftFill: string
  rightFill: string
}

interface VisualTile extends Tile {
  height: number
  silhouette: string
  rightFace: string
  faceShadeOpacity: number
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

function tintedSurface(surface: string, token: string, percentage: number) {
  return `color-mix(in srgb, ${surface} ${100 - percentage}%, var(${token}))`
}

function channels(color: string) {
  return [1, 3, 5].map((offset) =>
    parseInt(color.slice(offset, offset + 2), 16)
  )
}

function surfaceColor(x: number, y: number) {
  const lastColumn = SURFACE_FIELD[0].length - 1
  const lastRow = SURFACE_FIELD.length - 1
  const u = clamp(x / STAGE_WIDTH) * lastColumn
  const v = clamp(y / STAGE_HEIGHT) * lastRow
  const column = Math.min(Math.floor(u), lastColumn - 1)
  const row = Math.min(Math.floor(v), lastRow - 1)
  const alongX = u - column
  const alongY = v - row
  const corners = [
    channels(SURFACE_FIELD[row][column]),
    channels(SURFACE_FIELD[row][column + 1]),
    channels(SURFACE_FIELD[row + 1][column]),
    channels(SURFACE_FIELD[row + 1][column + 1])
  ]

  const blended = corners[0].map((_, channel) =>
    Math.round(
      (corners[0][channel] * (1 - alongX) + corners[1][channel] * alongX) *
        (1 - alongY) +
        (corners[2][channel] * (1 - alongX) + corners[3][channel] * alongX) *
          alongY
    )
  )

  return `#${blended.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

const indicatorSurface = surfaceColor(...INDICATOR_STAGE_CENTER)
const indicatorLeftFill = tintedSurface(indicatorSurface, INK_TOKEN, 16)
const indicatorRightFill = tintedSurface(indicatorSurface, PLUM_TOKEN, 8)

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
  const x = ORIGIN_X + (column - row) * GRID_STEP_X
  const y = ORIGIN_Y + (column + row) * GRID_STEP_Y
  const surface = surfaceColor(x, y)

  return {
    id,
    column,
    row,
    revealOrder:
      (column / (COLS - 1)) * 0.64 + ((ROWS - 1 - row) / (ROWS - 1)) * 0.36,
    x,
    y,
    leftFill: tintedSurface(surface, INK_TOKEN, 12),
    rightFill: tintedSurface(surface, PLUM_TOKEN, 6)
  }
}).sort((a, b) => a.y - b.y || a.x - b.x)

function patternHeight(tile: Tile, pattern: number) {
  const weeklyDensity =
    0.46 + seededUnit(pattern * 149 + tile.column * 37) * 0.44
  const active =
    seededUnit(pattern * 211 + tile.id * 53 + tile.row * 17) < weeklyDensity

  if (!active) return 0

  const intensity = seededUnit(pattern * 307 + tile.id * 97 + tile.column * 23)
  const level =
    intensity < 0.46
      ? 1
      : intensity < 0.72
        ? 2
        : intensity < 0.88
          ? 3
          : intensity < 0.97
            ? 4
            : 5
  const height = CONTRIBUTION_HEIGHTS[level]
  const maximumVisibleHeight = Math.min(
    MAX_HEIGHT,
    tile.y - TILE_HEIGHT / 2 - TOP_PADDING
  )
  const visibleHeight = Math.min(height, maximumVisibleHeight)

  return visibleHeight < CONTRIBUTION_HEIGHTS[1] ? 0 : visibleHeight
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
const resetIndicatorProgress = computed(() =>
  reducedMotion ? 1 : clamp(frameTime.value / (BUILD_DURATION + HOLD_DURATION))
)
const resetIndicatorHeight = computed(() =>
  frameTime.value < BUILD_DURATION + HOLD_DURATION
    ? (1 - resetIndicatorProgress.value) * 150
    : easeOutCubic(resetProgress.value) * 150
)
const resetIndicatorLeftFace = computed(() =>
  polygonPoints([
    [268.774, 432.187 - resetIndicatorHeight.value],
    [400, 507.951 - resetIndicatorHeight.value],
    [400, 507.951],
    [268.774, 432.187]
  ])
)
const resetIndicatorRightFace = computed(() =>
  polygonPoints([
    [400, 507.951 - resetIndicatorHeight.value],
    [531.225, 432.187 - resetIndicatorHeight.value],
    [531.225, 432.187],
    [400, 507.951]
  ])
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
    const raised = height > 0.5

    return {
      ...tile,
      height,
      silhouette: raised ? tileSilhouette(tile, height) : '',
      rightFace: raised ? tileRightFace(tile, height) : '',
      faceShadeOpacity:
        (1 - clamp(height / MAX_HEIGHT)) * MAX_FACE_SHADE_OPACITY,
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

function tileCorners(tile: Tile, elevation: number): readonly Point[] {
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

function tileSilhouette(tile: Tile, height: number) {
  const top = tileCorners(tile, height)
  const base = tileCorners(tile, 0)

  return polygonPoints([top[0], top[1], top[2], base[2], base[3], base[0]])
}

function tileRightFace(tile: Tile, height: number) {
  const top = tileCorners(tile, height)
  const base = tileCorners(tile, 0)

  return polygonPoints([top[3], top[2], base[2], base[3]])
}

const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed.value += delta
  },
  { immediate: false, fpsLimit: ANIMATION_FPS }
)

const documentVisibility = useDocumentVisibility()

watch(
  [onScreen, documentVisibility],
  ([visible, pageState]) => {
    if (visible && pageState === 'visible' && !reducedMotion) resume()
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
    :data-reset-indicator-progress="resetIndicatorProgress"
    :data-reset-indicator-height="resetIndicatorHeight"
    class="relative aspect-16/7 min-h-[207px] w-full overflow-hidden rounded-3xl bg-primary-comfy-ink lg:min-h-72"
  >
    <svg
      viewBox="0 0 760 360"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <g transform="translate(-23 136) scale(0.275)">
        <path
          d="M400 285.274C414.877 285.274 429.684 288.556 440.919 295.042L638.843 409.313C650.085 415.804 655.411 424.129 655.411 432.187C655.411 440.246 650.085 448.571 638.843 455.062L440.919 569.333C429.684 575.819 414.877 579.1 400 579.1C385.123 579.1 370.316 575.819 359.081 569.333L161.156 455.062C149.914 448.571 144.588 440.246 144.588 432.188C144.588 424.129 149.914 415.804 161.156 409.313L359.081 295.042C370.316 288.556 385.123 285.274 400 285.274Z"
          fill="var(--color-primary-comfy-ink)"
          stroke="var(--color-primary-comfy-plum)"
          stroke-width="2.6"
        />
        <template v-if="resetIndicatorHeight > 0.5">
          <polygon :points="resetIndicatorLeftFace" :fill="indicatorLeftFill" />
          <polygon
            :points="resetIndicatorRightFace"
            :fill="indicatorRightFill"
          />
        </template>
        <path
          d="M280.253 444.187C268.774 437.56 268.774 426.815 280.253 420.187L379.215 363.052C390.694 356.424 409.305 356.424 420.784 363.052L519.746 420.187C531.225 426.815 531.225 437.56 519.746 444.187L420.784 501.323C409.305 507.951 390.694 507.951 379.215 501.323L280.253 444.187Z"
          fill="var(--color-primary-comfy-yellow)"
          :transform="`translate(0 ${-resetIndicatorHeight})`"
        />
      </g>

      <g v-for="tile in visualTiles" :key="tile.id">
        <template v-if="tile.height > 0.5">
          <polygon :points="tile.silhouette" :fill="tile.leftFill" />
          <polygon :points="tile.rightFace" :fill="tile.rightFill" />
          <polygon
            :points="tile.silhouette"
            fill="var(--color-primary-comfy-ink)"
            :fill-opacity="tile.faceShadeOpacity"
          />
        </template>
        <rect
          :width="TILE_SIZE"
          :height="TILE_SIZE"
          rx="4"
          :transform="tileTransform(tile)"
          :fill="tile.topFill"
        />
      </g>
    </svg>
  </div>
</template>
