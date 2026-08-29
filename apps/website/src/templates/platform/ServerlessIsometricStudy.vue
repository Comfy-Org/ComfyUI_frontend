<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'
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
const ORIGIN_X = 260
const ORIGIN_Y = 60
const MAX_HEIGHT = 72
const TOP_PADDING = 18
const BUILD_DURATION = 1800
const HOLD_DURATION = 3000
const RESET_DURATION = 650
const CYCLE_DURATION = BUILD_DURATION + HOLD_DURATION + RESET_DURATION
const BUILD_STAGGER = 0.62
const MAX_TEXTURE_SHADE_OPACITY = 0.62
const CONTRIBUTION_HEIGHTS = [0, 14, 26, 40, 56, 72] as const

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
  textureShadeOpacity: number
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
      textureShadeOpacity:
        (1 - clamp(height / MAX_HEIGHT)) * MAX_TEXTURE_SHADE_OPACITY,
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
        <pattern
          id="isometric-field-texture"
          width="760"
          height="360"
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
        >
          <image
            href="/assets/platform/serverless/isometric-texture.webp"
            width="760"
            height="360"
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      </defs>

      <g v-for="tile in visualTiles" :key="tile.id">
        <template v-if="tile.height > 0.5">
          <polygon
            :points="leftFace(tile)"
            fill="url(#isometric-field-texture)"
          />
          <polygon
            :points="rightFace(tile)"
            fill="url(#isometric-field-texture)"
          />
          <g
            :opacity="tile.textureShadeOpacity"
            :data-texture-shade="tile.textureShadeOpacity"
          >
            <polygon
              :points="leftFace(tile)"
              fill="var(--color-primary-comfy-ink)"
            />
            <polygon
              :points="rightFace(tile)"
              fill="var(--color-primary-comfy-ink)"
            />
          </g>
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
          <polygon
            :points="polygonPoints(tileCorners(tile, tile.height))"
            fill="url(#isometric-field-texture)"
          />
          <polygon
            :points="polygonPoints(tileCorners(tile, tile.height))"
            fill="var(--color-primary-comfy-ink)"
            :fill-opacity="tile.textureShadeOpacity"
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
