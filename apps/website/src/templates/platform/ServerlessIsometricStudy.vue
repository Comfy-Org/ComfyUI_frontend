<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const TILE_SIZE = 34
const ISO_X = 0.866025
const ISO_Y = 0.5
const GRID_STEP_X = 35
const GRID_STEP_Y = 18.5
const ORIGIN_X = 235
const ORIGIN_Y = 60
const MAX_HEIGHT = 138
const HEIGHTS = [
  [0, 0, 0, 14, 32, 58, 74, 54, 28, 12, 0, 0],
  [0, 0, 12, 28, 54, 88, 108, 82, 46, 24, 10, 0],
  [0, 12, 26, 48, 76, 118, 138, 112, 72, 42, 18, 0],
  [0, 0, 14, 34, 62, 94, 112, 88, 54, 28, 12, 0],
  [0, 0, 0, 16, 36, 62, 78, 58, 32, 14, 0, 0]
] as const

interface Tile {
  id: number
  height: number
  x: number
  y: number
  topFill: string
  leftFill: string
  rightFill: string
}

type Point = readonly [number, number]

function mixedColor(token: string, percentage: number) {
  return `color-mix(in srgb, var(${token}) ${percentage}%, var(--color-primary-comfy-ink))`
}

const tiles: Tile[] = HEIGHTS.flatMap((row, rowIndex) =>
  row.map((height, columnIndex) => {
    const id = rowIndex * row.length + columnIndex
    const level = height / MAX_HEIGHT

    return {
      id,
      height,
      x: ORIGIN_X + (columnIndex - rowIndex) * GRID_STEP_X,
      y: ORIGIN_Y + (columnIndex + rowIndex) * GRID_STEP_Y,
      topFill:
        height > 0
          ? mixedColor('--color-primary-comfy-yellow', 58 + level * 42)
          : mixedColor('--color-primary-comfy-plum', 48 + ((id * 29) % 7) * 5),
      leftFill: mixedColor('--color-primary-comfy-yellow', 25 + level * 18),
      rightFill: mixedColor('--color-primary-comfy-yellow', 36 + level * 24)
    }
  })
).sort((a, b) => a.y - b.y || a.x - b.x)

function tileCorners(tile: Tile, elevation: number): readonly Point[] {
  const topY = tile.y - elevation
  const skewedWidth = TILE_SIZE * ISO_X
  const skewedHeight = TILE_SIZE * ISO_Y

  return [
    [tile.x, topY],
    [tile.x + skewedWidth, topY - skewedHeight],
    [tile.x + skewedWidth * 2, topY],
    [tile.x + skewedWidth, topY + skewedHeight]
  ]
}

function polygonPoints(points: readonly Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ')
}

function leftFace(tile: Tile) {
  const top = tileCorners(tile, tile.height)
  const base = tileCorners(tile, 0)

  return polygonPoints([top[0], top[3], base[3], base[0]])
}

function rightFace(tile: Tile) {
  const top = tileCorners(tile, tile.height)
  const base = tileCorners(tile, 0)

  return polygonPoints([top[3], top[2], base[2], base[3]])
}

function tileTransform(tile: Tile) {
  return `matrix(${ISO_X} ${-ISO_Y} ${ISO_X} ${ISO_Y} ${tile.x} ${tile.y - tile.height})`
}
</script>

<template>
  <div
    role="img"
    :aria-label="t('platform.serverlessVisual.ariaLabel', locale)"
    class="relative aspect-16/7 min-h-72 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink"
  >
    <svg
      viewBox="0 0 760 360"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <g v-for="tile in tiles" :key="tile.id">
        <template v-if="tile.height > 0">
          <polygon :points="leftFace(tile)" :fill="tile.leftFill" />
          <polygon :points="rightFace(tile)" :fill="tile.rightFill" />
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
