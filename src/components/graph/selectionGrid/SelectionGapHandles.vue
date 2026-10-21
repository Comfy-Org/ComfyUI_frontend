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
      :aria-orientation="AXIS_STYLES[bar.axis].orientation"
      :aria-valuenow="Math.round(bar.gap)"
      :class="
        cn(
          'group pointer-events-auto absolute flex -translate-1/2 touch-none items-center justify-center rounded-full outline-none',
          AXIS_STYLES[bar.axis].hitArea
        )
      "
      :style="{ left: `${bar.left}px`, top: `${bar.top}px` }"
      @pointerdown="onPointerDown($event, bar)"
      @keydown="onKeyDown($event, bar)"
      @keyup="onKeyUp($event, bar)"
      @focusout="commitPendingNudges"
      @wheel="canvasInteractions.forwardEventToCanvas"
    >
      <span
        :class="
          cn(
            'rounded-full bg-smoke-400 shadow-sm ring-1 ring-background transition-transform group-hover:scale-125 group-focus-visible:scale-125',
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
import { registerEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
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
  draggedGap: number | null
}

const AXIS_STYLES: Record<
  GapAxis,
  {
    orientation: 'vertical' | 'horizontal'
    hitArea: string
    pill: string
    label: string
  }
> = {
  x: {
    orientation: 'vertical',
    hitArea: 'h-8 w-3 cursor-ew-resize',
    pill: 'h-7 w-1',
    label: 'top-full mt-1'
  },
  y: {
    orientation: 'horizontal',
    hitArea: 'h-3 w-8 cursor-ns-resize',
    pill: 'h-1 w-7',
    label: 'left-full ml-1'
  }
}

const isDragging = defineModel<boolean>('dragging', { default: false })

const emit = defineEmits<{
  editStart: []
  edited: []
  dismiss: []
}>()

const { t } = useI18n()
const canvas = useCanvasStore().getCanvas()
const canvasInteractions = useCanvasInteractions()
const { gridNodes, measure } = useSelectionGrid()
const { drag, start, preview, commit, cancel, nudge, commitNudges } =
  useGapDragSession()

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
    if (nextViewport.lowQuality || isDraggingNodes.value) return

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
      top: (bar.y + offsetY) * scale + top.value,
      draggedGap:
        drag.value?.barKey === bar.key ? Math.round(drag.value.gap) : null
    }))
    .filter(
      (bar) =>
        bar.left >= left.value &&
        bar.left <= right.value &&
        bar.top >= top.value &&
        bar.top <= bottom.value
    )
})

const graphPointAlong = (event: PointerEvent, axis: GapAxis) => {
  const { scale, offset } = canvas.ds
  return axis === 'x'
    ? (event.clientX - canvasBounds.left.value) / scale - offset[0]
    : (event.clientY - canvasBounds.top.value) / scale - offset[1]
}

let dragListeners: AbortController | undefined

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock'
])

const stopDragListeners = () => {
  dragListeners?.abort()
  dragListeners = undefined
  isDragging.value = false
}

function onPointerDown(event: PointerEvent, bar: ScreenBar) {
  if (event.button !== 0 || drag.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const { pointerId } = event
  const origin = graphPointAlong(event, bar.axis)
  emit('editStart')
  start(bar)
  if (!drag.value) return

  stopDragListeners()
  dragListeners = new AbortController()
  isDragging.value = true
  const { signal } = dragListeners
  const isDragPointer = (pointerEvent: PointerEvent) =>
    pointerEvent.pointerId === pointerId
  const cancelDrag = () => {
    stopDragListeners()
    cancel()
  }
  const commitDrag = () => {
    stopDragListeners()
    commit()
    emit('edited')
  }
  window.addEventListener(
    'pointermove',
    (moveEvent) => {
      if (!isDragPointer(moveEvent)) return
      if (moveEvent.buttons === 0) commitDrag()
      else preview(graphPointAlong(moveEvent, bar.axis) - origin)
    },
    { signal }
  )
  window.addEventListener(
    'pointerup',
    (upEvent) => {
      if (isDragPointer(upEvent)) commitDrag()
    },
    { signal, capture: true }
  )
  window.addEventListener(
    'pointercancel',
    (cancelEvent) => {
      if (isDragPointer(cancelEvent)) cancelDrag()
    },
    { signal, capture: true }
  )
  window.addEventListener('blur', cancelDrag, { signal })
  window.addEventListener(
    'keydown',
    (keyEvent) => {
      if (MODIFIER_KEYS.has(keyEvent.key) || historyShortcut(keyEvent)) return
      keyEvent.preventDefault()
      keyEvent.stopImmediatePropagation()
      cancelDrag()
    },
    { signal, capture: true }
  )
}

const NUDGE_KEYS: Record<GapAxis, [decrease: string, increase: string]> = {
  x: ['ArrowLeft', 'ArrowRight'],
  y: ['ArrowUp', 'ArrowDown']
}

function onKeyDown(event: KeyboardEvent, bar: ScreenBar) {
  if (drag.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('dismiss')
    return
  }
  const [decrease, increase] = NUDGE_KEYS[bar.axis]
  const direction = event.key === increase ? 1 : event.key === decrease ? -1 : 0
  if (direction === 0) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) emit('editStart')
  const step = event.shiftKey ? 10 : 1
  nudge(bar, direction * step)
}

const commitPendingNudges = () => {
  if (commitNudges()) emit('edited')
}

function onKeyUp(event: KeyboardEvent, bar: ScreenBar) {
  if (NUDGE_KEYS[bar.axis].includes(event.key)) commitPendingNudges()
}

const unregisterEscapeOverride = registerEscapeOverride(
  (event) =>
    event.target instanceof Element &&
    event.target.closest('[data-gap-handle]') !== null
)

onBeforeUnmount(() => {
  unregisterEscapeOverride()
  stopDragListeners()
})
</script>
