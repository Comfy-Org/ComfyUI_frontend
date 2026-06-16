import { useRafFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  calculateMinimapScale,
  enforceMinimumBounds
} from '@/renderer/core/spatial/boundsCalculator'
import { MinimapDataSourceFactory } from '@/renderer/extensions/minimap/data/MinimapDataSourceFactory'

import type { MinimapBounds, MinimapCanvas, ViewportTransform } from '../types'

const VIEWPORT_MIN_VISIBLE = 4

function clampViewportSpan(
  start: number,
  size: number,
  max: number
): [number, number] {
  const lo = Math.max(0, Math.min(start, max - VIEWPORT_MIN_VISIBLE))
  const hi = Math.min(max, Math.max(start + size, VIEWPORT_MIN_VISIBLE))
  return [lo, Math.max(VIEWPORT_MIN_VISIBLE, hi - lo)]
}

export function useMinimapViewport(
  canvas: Ref<MinimapCanvas | null>,
  graph: Ref<LGraph | null>,
  width: number,
  height: number
) {
  const bounds = ref<MinimapBounds>({
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0
  })

  const scale = ref(1)
  const viewportTransform = ref<ViewportTransform>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  const canvasDimensions = ref({
    width: 0,
    height: 0
  })

  const updateCanvasDimensions = () => {
    const c = canvas.value
    if (!c) return

    const canvasEl = c.canvas
    const dpr = window.devicePixelRatio || 1

    canvasDimensions.value = {
      width: canvasEl.clientWidth || canvasEl.width / dpr,
      height: canvasEl.clientHeight || canvasEl.height / dpr
    }
  }

  const calculateGraphBounds = (): MinimapBounds => {
    // Use unified data source
    const dataSource = MinimapDataSourceFactory.create(graph.value)

    if (!dataSource.hasData()) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 }
    }

    const sourceBounds = dataSource.getBounds()
    return enforceMinimumBounds(sourceBounds)
  }

  const calculateScale = () => {
    return calculateMinimapScale(bounds.value, width, height)
  }

  const updateViewport = () => {
    const c = canvas.value
    if (!c) return

    if (
      canvasDimensions.value.width === 0 ||
      canvasDimensions.value.height === 0
    ) {
      updateCanvasDimensions()
    }

    const ds = c.ds

    const viewportWidth = canvasDimensions.value.width / ds.scale
    const viewportHeight = canvasDimensions.value.height / ds.scale

    const worldX = -ds.offset[0]
    const worldY = -ds.offset[1]

    const centerOffsetX = (width - bounds.value.width * scale.value) / 2
    const centerOffsetY = (height - bounds.value.height * scale.value) / 2

    const rawX = (worldX - bounds.value.minX) * scale.value + centerOffsetX
    const rawY = (worldY - bounds.value.minY) * scale.value + centerOffsetY
    const rawW = viewportWidth * scale.value
    const rawH = viewportHeight * scale.value

    const [x, w] = clampViewportSpan(rawX, rawW, width)
    const [y, h] = clampViewportSpan(rawY, rawH, height)

    const curr = viewportTransform.value
    if (curr.x === x && curr.y === y && curr.width === w && curr.height === h)
      return

    viewportTransform.value = { x, y, width: w, height: h }
  }

  const updateBounds = () => {
    bounds.value = calculateGraphBounds()
    scale.value = calculateScale()
  }

  const centerViewOn = (worldX: number, worldY: number) => {
    const c = canvas.value
    if (!c) return

    if (
      canvasDimensions.value.width === 0 ||
      canvasDimensions.value.height === 0
    ) {
      updateCanvasDimensions()
    }

    const ds = c.ds

    const viewportWidth = canvasDimensions.value.width / ds.scale
    const viewportHeight = canvasDimensions.value.height / ds.scale

    ds.offset[0] = -(worldX - viewportWidth / 2)
    ds.offset[1] = -(worldY - viewportHeight / 2)

    c.setDirty(true, true)
  }
  const { resume: startViewportSync, pause: stopViewportSync } =
    useRafFn(updateViewport)

  return {
    bounds: computed(() => bounds.value),
    scale: computed(() => scale.value),
    viewportTransform: computed(() => viewportTransform.value),
    canvasDimensions: computed(() => canvasDimensions.value),
    updateCanvasDimensions,
    updateViewport,
    updateBounds,
    centerViewOn,
    startViewportSync,
    stopViewportSync
  }
}
