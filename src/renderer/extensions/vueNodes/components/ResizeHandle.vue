<script setup lang="ts" generic="D extends ResizeDirection">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import type {
  CompassCorners,
  Point2D
} from '@comfyorg/shared-frontend-utils/geometry'
import { cn } from '@comfyorg/tailwind-utils'
import {
  isCorner,
  resizeAxes
} from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'
import type { ResizeDirection } from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'

const KEYBOARD_STEP = 16
const ARROW_KEY_DELTAS: Partial<Record<string, Point2D>> = {
  ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
  ArrowRight: { x: KEYBOARD_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEYBOARD_STEP },
  ArrowDown: { x: 0, y: KEYBOARD_STEP }
}

const CORNER_LABELS: Record<CompassCorners, string> = {
  SE: 'g.resizeFromBottomRight',
  NE: 'g.resizeFromTopRight',
  SW: 'g.resizeFromBottomLeft',
  NW: 'g.resizeFromTopLeft'
}

const {
  direction,
  focusable = false,
  class: className
} = defineProps<{
  direction: D
  focusable?: boolean
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{
  resize: [event: PointerEvent, direction: D]
  nudge: [event: KeyboardEvent, direction: D, delta: Point2D]
  fit: [event: Event]
}>()

const axes = computed(() => resizeAxes(direction))
const label = computed(() =>
  isCorner(direction) ? CORNER_LABELS[direction] : undefined
)
const cursorClass = computed(() => {
  const { x, y } = axes.value
  if (!x) return 'cursor-ns-resize'
  if (!y) return 'cursor-ew-resize'
  return x === y ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
})

const FIT_KEYS = new Set(['Enter', ' '])

function onKeydown(event: KeyboardEvent) {
  const delta = ARROW_KEY_DELTAS[event.key]
  const fits = FIT_KEYS.has(event.key)
  if (!delta && !fits) return
  event.preventDefault()
  event.stopPropagation()
  if (delta) emit('nudge', event, direction, delta)
  else emit('fit', event)
}
</script>

<template>
  <div
    :role="label && 'button'"
    :tabindex="focusable && label ? 0 : undefined"
    :aria-label="label && $t(label)"
    :aria-hidden="!label"
    :data-resize-direction="direction"
    :class="
      cn(
        'absolute touch-none select-none',
        axes.x === -1 && 'left-0',
        axes.x === 1 && 'right-0',
        axes.x === 0 && 'inset-x-0',
        axes.y === -1 && 'top-0',
        axes.y === 1 && 'bottom-0',
        axes.y === 0 && 'inset-y-0',
        label &&
          'rounded-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:outline-1 focus-visible:outline-ring',
        cursorClass,
        className
      )
    "
    @pointerdown.stop="emit('resize', $event, direction)"
    @keydown="onKeydown"
    @dblclick.stop="emit('fit', $event)"
  >
    <i
      v-if="label"
      aria-hidden="true"
      :class="
        cn(
          'absolute icon-[comfy--resize-corner] size-2/5',
          axes.x === 1 ? 'left-1' : 'right-1 -scale-x-100',
          axes.y === 1 ? 'top-1' : 'bottom-1 -scale-y-100'
        )
      "
    />
  </div>
</template>
