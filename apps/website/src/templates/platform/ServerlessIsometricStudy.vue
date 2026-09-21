<script setup lang="ts">
import {
  useDocumentVisibility,
  useElementVisibility,
  useRafFn
} from '@vueuse/core'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  useId,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const textureId = useId()

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
  transform: string
  left: string
  right: string
  texture: string
  topPoints: readonly Point[]
  leftPoints: readonly Point[]
  rightPoints: readonly Point[]
}

type Point = readonly [number, number]

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')
const canvasReady = ref(false)
const onScreen = useElementVisibility(stageRef)
const documentVisibility = useDocumentVisibility()
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

    const topPoints = tileCorners(tile, height)
    const base = tileCorners(tile, 0)
    const leftPoints = [topPoints[0], topPoints[3], base[3], base[0]]
    const rightPoints = [topPoints[3], topPoints[2], base[2], base[3]]
    const svgFallback = !canvasReady.value
    return {
      ...tile,
      height,
      topPoints,
      leftPoints,
      rightPoints,
      transform: svgFallback ? tileTransform({ ...tile, height }) : '',
      left: svgFallback ? polygonPoints(leftPoints) : '',
      right: svgFallback ? polygonPoints(rightPoints) : '',
      texture: svgFallback
        ? `${polygonPath(leftPoints)} ${polygonPath(rightPoints)} ${polygonPath(topPoints)}`
        : '',
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

function tileTransform(tile: Tile & { height: number }) {
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

function polygonPath(points: readonly Point[]) {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join('')}Z`
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.moveTo(...points[0])
  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(...points[index])
  }
  ctx.closePath()
}

let context: CanvasRenderingContext2D | null = null
let texture: CanvasPattern | null = null
let ink = ''
let plum = ''
let yellow = ''

onMounted(() => {
  context = canvasRef.value?.getContext('2d') ?? null
  if (!context || !stageRef.value) return
  const style = getComputedStyle(stageRef.value)
  ink = style.getPropertyValue('--color-primary-comfy-ink').trim()
  plum = style.getPropertyValue('--color-primary-comfy-plum').trim()
  yellow = style.getPropertyValue('--color-primary-comfy-yellow').trim()
  const image = new Image()
  image.onload = () => {
    if (!context) return
    const source = document.createElement('canvas')
    source.width = 760
    source.height = 360
    const sourceContext = source.getContext('2d')
    if (!sourceContext) return
    const scale = Math.max(760 / image.width, 360 / image.height)
    sourceContext.drawImage(
      image,
      (760 - image.width * scale) / 2,
      (360 - image.height * scale) / 2,
      image.width * scale,
      image.height * scale
    )
    texture = context.createPattern(source, 'repeat')
    canvasReady.value = texture !== null
  }
  image.src = '/assets/platform/serverless/isometric-texture.webp'
})

onUnmounted(() => {
  context = null
  texture = null
})

watchEffect(() => {
  if (!canvasReady.value || !context || !texture) return
  const ctx = context
  ctx.setTransform(2, 0, 0, 2, 0, 0)
  ctx.clearRect(0, 0, 760, 360)
  for (const tile of visualTiles.value) {
    if (tile.height > 0.5) {
      ctx.save()
      ctx.beginPath()
      tracePolygon(ctx, tile.leftPoints)
      tracePolygon(ctx, tile.rightPoints)
      tracePolygon(ctx, tile.topPoints)
      ctx.fillStyle = texture
      ctx.fill()
      ctx.fillStyle = ink
      ctx.globalAlpha = tile.textureShadeOpacity
      ctx.fill()
      ctx.globalAlpha = 0.12
      ctx.beginPath()
      tracePolygon(ctx, tile.leftPoints)
      ctx.fill()
      ctx.fillStyle = plum
      ctx.globalAlpha = 0.06
      ctx.beginPath()
      tracePolygon(ctx, tile.rightPoints)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    ctx.transform(ISO_X, -ISO_Y, ISO_X, ISO_Y, tile.x, tile.y - tile.height)
    ctx.fillStyle = tile.topFill
      .replace('var(--color-primary-comfy-yellow)', yellow)
      .replace('var(--color-primary-comfy-plum)', plum)
      .replace('var(--color-primary-comfy-ink)', ink)
    ctx.beginPath()
    ctx.roundRect(0, 0, TILE_SIZE, TILE_SIZE, 4)
    ctx.fill()
    ctx.restore()
  }
})

const { pause, resume } = useRafFn(
  ({ delta }) => {
    elapsed.value += delta
  },
  { immediate: false }
)

watch(
  [onScreen, documentVisibility],
  ([visible, tabVisibility]) => {
    if (visible && tabVisibility === 'visible' && !reducedMotion) resume()
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
    <canvas
      ref="canvasRef"
      width="1520"
      height="720"
      class="absolute inset-0 size-full object-contain"
      aria-hidden="true"
    />
    <svg
      viewBox="0 0 760 360"
      class="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <defs>
        <pattern
          :id="textureId"
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

      <g transform="translate(-23 136) scale(0.275)">
        <path
          d="M400 285.274C414.877 285.274 429.684 288.556 440.919 295.042L638.843 409.313C650.085 415.804 655.411 424.129 655.411 432.187C655.411 440.246 650.085 448.571 638.843 455.062L440.919 569.333C429.684 575.819 414.877 579.1 400 579.1C385.123 579.1 370.316 575.819 359.081 569.333L161.156 455.062C149.914 448.571 144.588 440.246 144.588 432.188C144.588 424.129 149.914 415.804 161.156 409.313L359.081 295.042C370.316 288.556 385.123 285.274 400 285.274Z"
          fill="var(--color-primary-comfy-ink)"
          stroke="var(--color-primary-comfy-plum)"
          stroke-width="2.6"
        />
        <template v-if="resetIndicatorHeight > 0.5">
          <polygon
            :points="resetIndicatorLeftFace"
            :fill="`url(#${textureId})`"
          />
          <polygon
            :points="resetIndicatorRightFace"
            :fill="`url(#${textureId})`"
          />
          <polygon
            :points="resetIndicatorLeftFace"
            fill="var(--color-primary-comfy-ink)"
            fill-opacity="0.16"
          />
          <polygon
            :points="resetIndicatorRightFace"
            fill="var(--color-primary-comfy-plum)"
            fill-opacity="0.08"
          />
        </template>
        <path
          d="M280.253 444.187C268.774 437.56 268.774 426.815 280.253 420.187L379.215 363.052C390.694 356.424 409.305 356.424 420.784 363.052L519.746 420.187C531.225 426.815 531.225 437.56 519.746 444.187L420.784 501.323C409.305 507.951 390.694 507.951 379.215 501.323L280.253 444.187Z"
          fill="var(--color-primary-comfy-yellow)"
          :transform="`translate(0 ${-resetIndicatorHeight})`"
        />
      </g>

      <g v-if="!canvasReady" v-memo="[visualTiles]">
        <g v-for="tile in visualTiles" :key="tile.id">
          <template v-if="tile.height > 0.5">
            <path :d="tile.texture" :fill="`url(#${textureId})`" />
            <path
              :d="tile.texture"
              fill="var(--color-primary-comfy-ink)"
              :opacity="tile.textureShadeOpacity"
              :data-texture-shade="tile.textureShadeOpacity"
            />
            <polygon
              :points="tile.left"
              fill="var(--color-primary-comfy-ink)"
              fill-opacity="0.12"
            />
            <polygon
              :points="tile.right"
              fill="var(--color-primary-comfy-plum)"
              fill-opacity="0.06"
            />
          </template>
          <rect
            :width="TILE_SIZE"
            :height="TILE_SIZE"
            rx="4"
            :transform="tile.transform"
            :fill="tile.topFill"
          />
        </g>
      </g>
    </svg>
  </div>
</template>
