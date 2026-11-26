<template>
  <div
    v-if="screenBars.length > 0"
    class="pointer-events-none fixed top-0 left-0 z-30"
  >
    <div
      v-for="bar in screenBars"
      :key="bar.key"
      data-gap-handle
      role="spinbutton"
      tabindex="0"
      :aria-label="t('g.gapHandle')"
      :aria-valuemin="minimumBarGap(bar)"
      :aria-valuenow="Math.round(bar.gap)"
      :aria-valuetext="
        t('g.gapValue', { value: Math.round(bar.gap) }, Math.round(bar.gap))
      "
      :class="
        cn(
          'group absolute flex -translate-1/2 touch-none items-center justify-center rounded-full outline-none',
          bar.screenGap > 0 && 'pointer-events-auto',
          AXIS_STYLES[bar.axis].hitArea
        )
      "
      :style="{
        left: `${bar.left}px`,
        top: `${bar.top}px`,
        [bar.axis === 'x' ? 'maxWidth' : 'maxHeight']: `${bar.screenGap}px`
      }"
      @pointerdown="onPointerDown($event, bar)"
      @keydown="onKeyDown($event, bar)"
      @keyup="onKeyUp($event, bar)"
      @focusout="commitNudges"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <span
        :class="
          cn(
            'pointer-events-none rounded-full bg-smoke-400 shadow-sm ring-1 ring-background transition-transform group-hover:scale-125 group-focus-visible:scale-125',
            AXIS_STYLES[bar.axis].pill,
            bar.draggedGap !== null && 'scale-125'
          )
        "
      />
      <span
        v-if="bar.draggedGap !== null"
        :class="
          cn(
            'pointer-events-none absolute rounded-sm bg-smoke-400 px-1 text-xs text-background tabular-nums',
            AXIS_STYLES[bar.axis].label
          )
        "
      >
        {{ bar.draggedGap }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementBounding, useEventListener, useRafFn } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'
import { isEqual } from 'es-toolkit'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  computeGapBars,
  detectSelectionGrid,
  minimumBarGap
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type {
  GapAxis,
  GapBar,
  LayoutBox
} from '@/components/graph/selectionGrid/selectionGridLayout'
import type { useTidySession } from '@/components/graph/selectionGrid/useTidySession'
import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@comfyorg/graph-state/layout/layoutStore'
import { historyShortcut } from '@/scripts/changeTracker'

interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
  lowQuality: boolean
}

interface ScreenBar extends GapBar {
  left: number
  top: number
  screenGap: number
  draggedGap: number | null
}

const AXIS_STYLES: Record<
  GapAxis,
  {
    hitArea: string
    pill: string
    label: string
  }
> = {
  x: {
    hitArea: 'h-8 w-3 cursor-ew-resize',
    pill: 'h-7 w-1',
    label: 'top-full mt-1'
  },
  y: {
    hitArea: 'h-3 w-8 cursor-ns-resize',
    pill: 'h-1 w-7',
    label: 'left-full ml-1'
  }
}

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock'
])

const SLOT_HIT_RADIUS = 12
const HANDLE_HALF_LENGTH = 16

const { session } = defineProps<{
  session: ReturnType<typeof useTidySession>['handles']
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const { t } = useI18n()
const canvas = useCanvasStore().getCanvas()
const canvasInteractions = useCanvasInteractions()
const { gridNodes, measure } = useSelectionGrid()
const { drag, start, preview, commit, cancel, nudge, commitNudges } = session

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

const measuredBoxes = shallowRef<LayoutBox[]>([])
const slots = shallowRef<{ x: number; y: number }[]>([])
const bars = computed(() =>
  computeGapBars(detectSelectionGrid(measuredBoxes.value))
)
const viewport = shallowRef<Viewport>({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  lowQuality: false
})
let dragListeners: AbortController | undefined

const isSameBox = (a: LayoutBox, b: LayoutBox | undefined) =>
  b !== undefined &&
  a.id === b.id &&
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height

const isSameBoxes = (a: LayoutBox[], b: LayoutBox[]) =>
  a.length === b.length && a.every((box, i) => isSameBox(box, b[i]))

const isSameViewport = (a: Viewport, b: Viewport) =>
  a.scale === b.scale &&
  a.offsetX === b.offsetX &&
  a.offsetY === b.offsetY &&
  a.lowQuality === b.lowQuality

const syncViewport = (): Viewport => {
  const { scale, offset } = canvas.ds
  const next = {
    scale,
    offsetX: offset[0],
    offsetY: offset[1],
    lowQuality: canvas.low_quality
  }
  if (!isSameViewport(next, viewport.value)) viewport.value = next
  return next
}

function sampleGeometry() {
  const boxes = measure()
  if (!isSameBoxes(boxes, measuredBoxes.value)) measuredBoxes.value = boxes
  const points = gridNodes.value
    .flatMap((node) => [
      ...node.inputs.map((_, index) => node.getInputPos(index)),
      ...node.outputs.map((_, index) => node.getOutputPos(index))
    ])
    .map(([x, y]) => ({ x, y }))
  if (!isEqual(points, slots.value)) slots.value = points
}

const { pause, resume } = useRafFn(
  () => {
    const { lowQuality } = syncViewport()
    if (!lowQuality && !isDraggingNodes.value) sampleGeometry()
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
    measuredBoxes.value = []
    slots.value = []
  },
  { immediate: true }
)

const screenBars = computed((): ScreenBar[] => {
  const { scale, offsetX, offsetY, lowQuality } = viewport.value
  if (isDraggingNodes.value || lowQuality) return []
  const { left, top, right, bottom } = canvasBounds
  return bars.value
    .map((bar) => {
      const x = (bar.x + offsetX) * scale + left.value
      const y = (bar.y + offsetY) * scale + top.value
      const radius = SLOT_HIT_RADIUS * scale
      const reach = HANDLE_HALF_LENGTH + radius
      const horizontal = bar.axis === 'x'
      const clearances = slots.value.map((slot) => {
        const dx = (slot.x - bar.x) * scale
        const dy = (slot.y - bar.y) * scale
        return {
          available: Math.abs(horizontal ? dx : dy) - radius,
          across: horizontal ? dy : dx
        }
      })
      function halfHitWidthAt(offset: number) {
        return clearances.reduce(
          (width, { available, across }) =>
            Math.abs(across - offset) < reach
              ? Math.min(width, available)
              : width,
          (bar.gap * scale) / 2
        )
      }
      const min = horizontal ? top.value - y : left.value - x
      const max = horizontal ? bottom.value - y : right.value - x
      const crossOffset =
        halfHitWidthAt(0) <= 0 && bar.gap > 0
          ? (clearances
              .filter(({ available }) => available <= 0)
              .flatMap(({ across }) => [
                Math.floor(across - reach),
                Math.ceil(across + reach)
              ])
              .filter((offset) => offset >= min && offset <= max)
              .sort((a, b) => Math.abs(a) - Math.abs(b))
              .find((offset) => halfHitWidthAt(offset) > 0) ?? 0)
          : 0
      return {
        ...bar,
        left: x + (horizontal ? 0 : crossOffset),
        top: y + (horizontal ? crossOffset : 0),
        screenGap: Math.max(0, 2 * halfHitWidthAt(crossOffset)),
        draggedGap:
          drag.value?.bar.key === bar.key ? Math.round(drag.value.gap) : null
      }
    })
    .filter(
      (bar) =>
        bar.left >= left.value &&
        bar.left <= right.value &&
        bar.top >= top.value &&
        bar.top <= bottom.value
    )
})

const graphPointAlong = (event: PointerEvent, axis: GapAxis) => {
  const [x, y] = canvas.convertCanvasToOffset([
    event.clientX - canvasBounds.left.value,
    event.clientY - canvasBounds.top.value
  ])
  return axis === 'x' ? x : y
}

const stopDragListeners = () => {
  dragListeners?.abort()
  dragListeners = undefined
}

watch(
  () => Boolean(drag.value),
  (dragging) => {
    if (!dragging) stopDragListeners()
  },
  { flush: 'sync' }
)

const cancelsDrag = (event: KeyboardEvent) =>
  !MODIFIER_KEYS.has(event.key) && historyShortcut(event) === undefined

function followDrag(pointerId: number, axis: GapAxis, origin: number) {
  stopDragListeners()
  dragListeners = new AbortController()
  const { signal } = dragListeners
  const isDragPointer = (pointerEvent: PointerEvent) =>
    pointerEvent.pointerId === pointerId
  window.addEventListener(
    'pointermove',
    (moveEvent) => {
      if (!isDragPointer(moveEvent)) return
      if (moveEvent.buttons === 0) commit()
      else preview(graphPointAlong(moveEvent, axis) - origin)
    },
    { signal }
  )
  window.addEventListener(
    'pointerup',
    (upEvent) => {
      if (isDragPointer(upEvent)) commit()
    },
    { signal, capture: true }
  )
  window.addEventListener(
    'pointercancel',
    (cancelEvent) => {
      if (isDragPointer(cancelEvent)) cancel()
    },
    { signal, capture: true }
  )
  window.addEventListener('blur', cancel, { signal })
  window.addEventListener(
    'keydown',
    (keyEvent) => {
      if (!cancelsDrag(keyEvent)) return
      keyEvent.preventDefault()
      keyEvent.stopImmediatePropagation()
      cancel()
    },
    { signal, capture: true }
  )
}

function onPointerDown(event: PointerEvent, bar: ScreenBar) {
  if (event.button !== 0 || drag.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const origin = graphPointAlong(event, bar.axis)
  start(bar)
  if (drag.value) followDrag(event.pointerId, bar.axis, origin)
}

const nudgeDirectionOf = (key: string, axis: GapAxis): number => {
  if (key === 'ArrowUp' || (axis === 'x' && key === 'ArrowRight')) return 1
  if (key === 'ArrowDown' || (axis === 'x' && key === 'ArrowLeft')) return -1
  return 0
}

function onKeyDown(event: KeyboardEvent, bar: ScreenBar) {
  if (drag.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('dismiss')
    return
  }
  const direction = nudgeDirectionOf(event.key, bar.axis)
  if (direction === 0) return
  event.preventDefault()
  event.stopPropagation()
  const step = event.shiftKey ? 10 : 1
  nudge(bar, direction * step)
}

function onKeyUp(event: KeyboardEvent, bar: ScreenBar) {
  if (nudgeDirectionOf(event.key, bar.axis) !== 0) commitNudges()
}

const unregisterEscapeOverride = registerEscapeOverride(
  (event) =>
    event.target instanceof Element &&
    event.target.closest('[data-gap-handle]') !== null
)

onBeforeUnmount(() => {
  unregisterEscapeOverride()
  stopDragListeners()
  cancel()
  commitNudges()
})
</script>
