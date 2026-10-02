<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Corner, Rect } from '../../../lib/workshop/move-anything/arrange'
import { nudgeFor } from '../../../lib/workshop/nudge'
import { rectStyle } from '../app-editor/stage-geometry'

const { rect, label, description } = defineProps<{
  rect: Rect
  label: string
  description: string
}>()

const emit = defineEmits<{
  grab: [event: PointerEvent, corner?: Corner]
  nudge: [dx: number, dy: number]
}>()

const CORNERS = [
  { corner: 'nw', place: '-top-1.5 -left-1.5 cursor-nwse-resize' },
  { corner: 'ne', place: '-top-1.5 -right-1.5 cursor-nesw-resize' },
  { corner: 'sw', place: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
  { corner: 'se', place: '-right-1.5 -bottom-1.5 cursor-nwse-resize' }
] as const satisfies readonly { corner: Corner; place: string }[]

function onKey(event: KeyboardEvent) {
  const step = nudgeFor(event)
  if (!step) return
  event.preventDefault()
  emit('nudge', step[0], step[1])
}
</script>

<template>
  <button
    type="button"
    :aria-label="description"
    class="absolute cursor-move touch-none rounded-sm border-[1.5px] border-dashed border-primary-warm-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)] focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
    :style="rectStyle(rect)"
    data-testid="swap-box"
    @pointerdown="emit('grab', $event)"
    @keydown="onKey"
  >
    <span
      class="absolute -top-6 -left-px flex h-5 items-center rounded-full bg-primary-warm-white px-2 text-[10px] font-medium whitespace-nowrap text-primary-comfy-ink shadow-md shadow-black/30"
    >
      {{ label }}
    </span>
    <span
      v-for="handle in CORNERS"
      :key="handle.corner"
      :class="
        cn(
          'absolute size-3 rounded-full border-2 border-primary-comfy-ink bg-primary-warm-white shadow-sm',
          handle.place
        )
      "
      aria-hidden="true"
      @pointerdown.stop="emit('grab', $event, handle.corner)"
    />
  </button>
</template>
