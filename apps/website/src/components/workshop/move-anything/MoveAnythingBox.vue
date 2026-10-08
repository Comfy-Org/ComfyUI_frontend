<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Corner, Rect } from '@/lib/workshop/move-anything/arrange'

const { rect, n, label, description, selected } = defineProps<{
  rect: Rect
  n: number
  label: string
  description: string
  selected: boolean
}>()

const emit = defineEmits<{
  grab: [event: PointerEvent, corner?: Corner]
  nudge: [dx: number, dy: number]
}>()

const CORNERS: readonly { corner: Corner; place: string }[] = [
  { corner: 'nw', place: '-top-1 -left-1 cursor-nwse-resize' },
  { corner: 'ne', place: '-top-1 -right-1 cursor-nesw-resize' },
  { corner: 'sw', place: '-bottom-1 -left-1 cursor-nesw-resize' },
  { corner: 'se', place: '-right-1 -bottom-1 cursor-nwse-resize' }
]

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

function onKey(event: KeyboardEvent) {
  const step = KEYS[event.key]
  if (!step) return
  event.preventDefault()
  const size = event.shiftKey ? 0.05 : 0.01
  emit('nudge', step[0] * size, step[1] * size)
}
</script>

<template>
  <button
    type="button"
    :aria-label="description"
    :aria-pressed="selected"
    :class="
      cn(
        'absolute cursor-move touch-none rounded-sm border-[1.5px] focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
        selected
          ? 'border-primary-comfy-yellow'
          : 'border-primary-warm-white/90'
      )
    "
    :style="{
      left: `${rect.x * 100}%`,
      top: `${rect.y * 100}%`,
      width: `${rect.w * 100}%`,
      height: `${rect.h * 100}%`
    }"
    @pointerdown="emit('grab', $event)"
    @keydown="onKey"
  >
    <span
      :class="
        cn(
          'absolute -top-5.5 -left-px flex h-4.5 items-center gap-1 rounded-sm pr-1.5 pl-0.5 text-[10px] font-medium whitespace-nowrap text-primary-comfy-ink',
          selected ? 'bg-primary-comfy-yellow' : 'bg-primary-warm-white/90'
        )
      "
    >
      <span
        class="flex size-3.5 items-center justify-center rounded-sm bg-primary-comfy-ink text-[9px] text-primary-warm-white"
        >{{ n }}</span
      >
      {{ label }}
    </span>
    <template v-if="selected">
      <span
        v-for="handle in CORNERS"
        :key="handle.corner"
        :class="
          cn(
            'absolute size-2 rounded-xs border-[1.5px] border-primary-comfy-yellow bg-primary-comfy-ink',
            handle.place
          )
        "
        aria-hidden="true"
        @pointerdown.stop="emit('grab', $event, handle.corner)"
      />
    </template>
  </button>
</template>
