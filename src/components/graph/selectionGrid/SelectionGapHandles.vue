<template>
  <div
    v-if="screenBars.length > 0"
    class="pointer-events-none fixed top-0 left-0 z-30"
  >
    <div
      v-for="bar in screenBars"
      :key="bar.key"
      data-gap-handle
      role="separator"
      tabindex="0"
      :aria-label="t('g.gapHandle')"
      :aria-orientation="bar.axis === 'x' ? 'vertical' : 'horizontal'"
      :aria-valuenow="Math.round(bar.gap)"
      :class="
        cn(
          'group pointer-events-auto absolute flex -translate-1/2 touch-none items-center justify-center rounded-full outline-none',
          bar.axis === 'x'
            ? 'h-8 w-3 cursor-ew-resize'
            : 'h-3 w-8 cursor-ns-resize'
        )
      "
      :style="{ left: `${bar.left}px`, top: `${bar.top}px` }"
      @pointerdown="onPointerDown($event, bar)"
      @keydown="onKeyDown($event, bar)"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <span
        :class="
          cn(
            'rounded-full bg-smoke-400 shadow-sm ring-1 ring-background transition-transform group-hover:scale-125 group-focus-visible:scale-125',
            bar.axis === 'x' ? 'h-7 w-1' : 'h-1 w-7',
            drag?.barKey === bar.key && 'scale-125'
          )
        "
      />
      <span
        v-if="drag?.barKey === bar.key"
        :class="
          cn(
            'pointer-events-none absolute rounded-sm bg-smoke-400 px-1 text-xs text-background tabular-nums',
            bar.axis === 'x' ? 'top-full mt-1' : 'left-full ml-1'
          )
        "
      >
        {{ Math.round(drag.gap) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener, useRafFn } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  computeGapBars,
  detectSelectionGrid
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  GapAxis,
  GapBar,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import { useGapDragSession } from '@/components/graph/selectionGrid/useGapDragSession'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
  lowQuality: boolean
}

interface ScreenBar extends GapBar {
  left: number
  top: number
}

const { t } = useI18n()
const canvas = useCanvasStore().getCanvas()
const canvasInteractions = useCanvasInteractions()
const { gridNodes, measure } = useSelectionGrid()
const { drag, start, preview, commit, cancel, nudge } = useGapDragSession()

const canvasBounds = useElementBounding(canvas.canvas)

const isDraggingCanvasItems = ref(canvas.isDragging)
useEventListener(
  canvas.canvas,
  'litegraph:dragging-items-changed',
  (event: CustomEvent<{ dragging: boolean }>) => {
    isDraggingCanvasItems.value = event.detail.dragging
  }
)
const isDraggingNodes = computed(
  () => isDraggingCanvasItems.value || layoutStore.isDraggingVueNodes.value
)

const bars = shallowRef<GapBar[]>([])
const viewport = shallowRef<Viewport>({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  lowQuality: false
})
let measuredBoxes: LayoutBox[] = []

const isSameBox = (a: LayoutBox, b: LayoutBox | undefined) =>
  b !== undefined &&
  a.id === b.id &&
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height

const isSameViewport = (a: Viewport, b: Viewport) =>
  a.scale === b.scale &&
  a.offsetX === b.offsetX &&
  a.offsetY === b.offsetY &&
  a.lowQuality === b.lowQuality

const { pause, resume } = useRafFn(
  () => {
    const { scale, offset } = canvas.ds
    const nextViewport = {
      scale,
      offsetX: offset[0],
      offsetY: offset[1],
      lowQuality: canvas.low_quality
    }
    if (!isSameViewport(nextViewport, viewport.value)) {
      viewport.value = nextViewport
    }

    const boxes = measure()
    const unchanged =
      boxes.length === measuredBoxes.length &&
      boxes.every((box, i) => isSameBox(box, measuredBoxes[i]))
    if (unchanged) return
    measuredBoxes = boxes
    bars.value = computeGapBars(detectSelectionGrid(boxes))
  },
  { immediate: false }
)

watch(
  () => gridNodes.value.length >= 2,
  (hasGrid) => {
    if (hasGrid) {
      resume()
      return
    }
    pause()
    measuredBoxes = []
    bars.value = []
  },
  { immediate: true }
)

const screenBars = computed((): ScreenBar[] => {
  const { scale, offsetX, offsetY, lowQuality } = viewport.value
  if (isDraggingNodes.value || lowQuality) return []
  const { left, top, right, bottom } = canvasBounds
  return bars.value
    .map((bar) => ({
      ...bar,
      left: (bar.x + offsetX) * scale + left.value,
      top: (bar.y + offsetY) * scale + top.value
    }))
    .filter(
      (bar) =>
        bar.left >= left.value &&
        bar.left <= right.value &&
        bar.top >= top.value &&
        bar.top <= bottom.value
    )
})

const pointerAlong = (event: PointerEvent, axis: GapAxis) =>
  axis === 'x' ? event.clientX : event.clientY

let dragListeners: AbortController | undefined

const stopDragListeners = () => {
  dragListeners?.abort()
  dragListeners = undefined
}

function onPointerDown(event: PointerEvent, bar: ScreenBar) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const origin = pointerAlong(event, bar.axis)
  const { scale } = canvas.ds
  start(bar)

  stopDragListeners()
  dragListeners = new AbortController()
  const { signal } = dragListeners
  window.addEventListener(
    'pointermove',
    (moveEvent) =>
      preview((pointerAlong(moveEvent, bar.axis) - origin) / scale),
    { signal }
  )
  window.addEventListener(
    'pointerup',
    () => {
      stopDragListeners()
      commit()
    },
    { signal }
  )
  window.addEventListener(
    'pointercancel',
    () => {
      stopDragListeners()
      cancel()
    },
    { signal }
  )
  window.addEventListener(
    'keydown',
    (keyEvent) => {
      if (keyEvent.key !== 'Escape') return
      keyEvent.preventDefault()
      keyEvent.stopImmediatePropagation()
      stopDragListeners()
      cancel()
    },
    { signal, capture: true }
  )
}

const NUDGE_KEYS: Record<GapAxis, [decrease: string, increase: string]> = {
  x: ['ArrowLeft', 'ArrowRight'],
  y: ['ArrowUp', 'ArrowDown']
}

function onKeyDown(event: KeyboardEvent, bar: ScreenBar) {
  const [decrease, increase] = NUDGE_KEYS[bar.axis]
  const direction = event.key === increase ? 1 : event.key === decrease ? -1 : 0
  if (direction === 0) return
  event.preventDefault()
  event.stopPropagation()
  const step = event.shiftKey ? 10 : 1
  nudge(bar, direction * step)
}

onBeforeUnmount(() => {
  stopDragListeners()
  cancel()
})
</script>
