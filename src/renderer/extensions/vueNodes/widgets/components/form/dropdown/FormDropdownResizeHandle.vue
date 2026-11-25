<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { resizePanel } from './resizePanel'
import type { PanelSize } from './resizePanel'

const KEYBOARD_STEP = 16
const KEYBOARD_MOVES: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
  ArrowRight: { x: KEYBOARD_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEYBOARD_STEP },
  ArrowDown: { x: 0, y: KEYBOARD_STEP }
}

const size = defineModel<PanelSize>('size')
const handleRef = useTemplateRef<HTMLElement>('handleRef')

let drag:
  | { pointerId: number; panel: PanelMeasure; x: number; y: number }
  | undefined

type PanelMeasure = { start: PanelSize; max: PanelSize; growsUp: boolean }

function measurePanel(): PanelMeasure | undefined {
  const panel = handleRef.value?.parentElement
  if (!panel) return
  const { width, height } = panel.getBoundingClientRect()
  const style = getComputedStyle(panel)
  return {
    start: { width, height },
    max: {
      width: parseFloat(style.maxWidth) || Infinity,
      height: parseFloat(style.maxHeight) || Infinity
    },
    growsUp: panel.dataset.side === 'top'
  }
}

function resizeFrom(panel: PanelMeasure, pointer: { x: number; y: number }) {
  size.value = resizePanel(panel.start, pointer, panel)
}

function onPointerDown(event: PointerEvent) {
  if (drag) return
  const panel = measurePanel()
  if (!panel) return
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
  resizeFrom(panel, move)
}
</script>

<template>
  <div
    ref="handleRef"
    role="button"
    tabindex="0"
    :aria-label="$t('widgets.uploadSelect.resize')"
    :title="$t('widgets.uploadSelect.resize')"
    class="absolute left-0 z-10 flex size-6 touch-none items-center justify-center rounded-lg text-muted-foreground select-none group-data-[side=bottom]/dropdown:bottom-0 group-data-[side=bottom]/dropdown:cursor-nesw-resize group-data-[side=top]/dropdown:top-0 group-data-[side=top]/dropdown:cursor-nwse-resize hover:text-foreground focus-visible:text-foreground focus-visible:outline-1 focus-visible:outline-ring"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @keydown="onKeydown"
  >
    <i class="icon-[lucide--grip] size-3" aria-hidden="true" />
  </div>
</template>
