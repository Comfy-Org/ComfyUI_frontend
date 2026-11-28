<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { growsRight, resizePanel, roomInViewport } from './resizePanel'
import type { PanelSide, PanelSize, ResizeHandle } from './resizePanel'

const KEYBOARD_STEP = 16
const KEYBOARD_MOVES: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
  ArrowRight: { x: KEYBOARD_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEYBOARD_STEP },
  ArrowDown: { x: 0, y: KEYBOARD_STEP }
}

const HANDLE_CLASSES: Record<ResizeHandle, string> = {
  'left-corner':
    '-left-4 size-8 justify-end group-data-[side=bottom]/dropdown:-bottom-4 group-data-[side=bottom]/dropdown:cursor-nesw-resize group-data-[side=bottom]/dropdown:items-start group-data-[side=top]/dropdown:-top-4 group-data-[side=top]/dropdown:cursor-nwse-resize group-data-[side=top]/dropdown:items-end',
  'right-corner':
    '-right-4 size-8 justify-start group-data-[side=bottom]/dropdown:-bottom-4 group-data-[side=bottom]/dropdown:cursor-nwse-resize group-data-[side=bottom]/dropdown:items-start group-data-[side=top]/dropdown:-top-4 group-data-[side=top]/dropdown:cursor-nesw-resize group-data-[side=top]/dropdown:items-end',
  'left-edge': 'inset-y-4 -left-1 w-2 cursor-ew-resize',
  'free-edge':
    'inset-x-4 h-2 cursor-ns-resize group-data-[side=bottom]/dropdown:-bottom-1 group-data-[side=top]/dropdown:-top-1'
}

const CORNER_LABELS: Partial<Record<ResizeHandle, string>> = {
  'left-corner': 'widgets.uploadSelect.resizeLeftCorner',
  'right-corner': 'widgets.uploadSelect.resizeRightCorner'
}

const { handle, anchor } = defineProps<{
  handle: ResizeHandle
  anchor?: HTMLElement
}>()
const cornerLabel = CORNER_LABELS[handle]
const size = defineModel<PanelSize>('size')
const alignOffset = defineModel<number>('alignOffset', { default: 0 })
const side = defineModel<PanelSide>('side')
const handleRef = useTemplateRef<HTMLElement>('handleRef')

type PanelMeasure = {
  start: PanelSize
  startOffset: number
  max: PanelSize
  growsUp: boolean
}

let drag:
  | { pointerId: number; panel: PanelMeasure; x: number; y: number }
  | undefined

function measurePanel(): PanelMeasure | undefined {
  const panel = handleRef.value?.parentElement
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  const style = getComputedStyle(panel)
  const growsUp = panel.dataset.side === 'top'
  const room = roomInViewport(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    { handle, growsUp }
  )
  return {
    start: { width: rect.width, height: rect.height },
    startOffset: anchor
      ? anchor.getBoundingClientRect().right - rect.right
      : alignOffset.value,
    max: {
      width: Math.min(parseFloat(style.maxWidth) || Infinity, room.width),
      height: Math.min(parseFloat(style.maxHeight) || Infinity, room.height)
    },
    growsUp
  }
}

function resizeFrom(panel: PanelMeasure, pointer: { x: number; y: number }) {
  const next = resizePanel(panel.start, pointer, { ...panel, handle })
  size.value = next
  alignOffset.value = growsRight(handle)
    ? panel.startOffset - (next.width - panel.start.width)
    : panel.startOffset
}

function pinSide(panel: PanelMeasure) {
  side.value = panel.growsUp ? 'top' : 'bottom'
}

function onPointerDown(event: PointerEvent) {
  if (drag) return
  const panel = measurePanel()
  if (!panel) return
  pinSide(panel)
  handleRef.value?.setPointerCapture(event.pointerId)
  drag = {
    pointerId: event.pointerId,
    panel,
    x: event.clientX,
    y: event.clientY
  }
}

function onPointerMove(event: PointerEvent) {
  if (drag?.pointerId !== event.pointerId) return
  resizeFrom(drag.panel, {
    x: event.clientX - drag.x,
    y: event.clientY - drag.y
  })
}

function onPointerEnd(event: PointerEvent) {
  if (drag?.pointerId === event.pointerId) drag = undefined
}

function onKeydown(event: KeyboardEvent) {
  const move = KEYBOARD_MOVES[event.key]
  const panel = measurePanel()
  if (!move || !panel) return
  event.preventDefault()
  pinSide(panel)
  resizeFrom(panel, move)
}

function resetSize() {
  size.value = undefined
  alignOffset.value = 0
  side.value = undefined
}
</script>

<template>
  <div
    ref="handleRef"
    :role="cornerLabel && 'button'"
    :tabindex="cornerLabel && 0"
    :aria-label="cornerLabel && $t(cornerLabel)"
    :aria-hidden="!cornerLabel"
    :title="$t('widgets.uploadSelect.resizeHint')"
    :class="
      cn(
        'absolute z-10 touch-none select-none',
        cornerLabel &&
          'flex rounded-lg p-1 text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-1 focus-visible:outline-ring',
        HANDLE_CLASSES[handle]
      )
    "
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @keydown="onKeydown"
    @dblclick="resetSize"
  >
    <i
      v-if="cornerLabel"
      class="icon-[lucide--grip] size-3"
      aria-hidden="true"
    />
  </div>
</template>
