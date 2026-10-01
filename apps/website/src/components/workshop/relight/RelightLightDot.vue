<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Light } from '../../../lib/workshop/relight/lights'
import { nudgeFor } from '../../../lib/workshop/nudge'

const { light, label, selected } = defineProps<{
  light: Light
  label: string
  selected: boolean
}>()

const emit = defineEmits<{
  grab: [event: PointerEvent]
  nudge: [dx: number, dy: number]
}>()

const arrowLength = computed(() => {
  const reach = Math.cos((light.elevation * Math.PI) / 180)
  return selected ? 30 + reach * 34 : 18 + reach * 16
})

function onGrab(event: PointerEvent) {
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.focus({ preventScroll: true })
  emit('grab', event)
}

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
    :aria-label="label"
    :aria-pressed="selected"
    :class="
      cn(
        'absolute -translate-1/2 cursor-move touch-none rounded-full border-2 border-primary-warm-white shadow-md shadow-black/50 transition-[width,height,opacity] before:absolute before:-inset-2.5 before:content-[\'\'] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-comfy-yellow/70',
        selected ? 'z-10 size-5' : 'size-3.5 opacity-75 hover:opacity-100',
        !light.visible && 'opacity-40'
      )
    "
    :style="{
      left: `${light.x * 100}%`,
      top: `${light.y * 100}%`,
      backgroundColor: light.color,
      color: light.color
    }"
    @pointerdown="onGrab"
    @keydown="onKey"
  >
    <span
      v-if="selected"
      class="pointer-events-none absolute top-1/2 left-1/2 size-11 -translate-1/2 rounded-full border-2 border-current bg-current/15 shadow-[0_0_24px_4px_currentColor]"
      aria-hidden="true"
    />
    <svg
      v-if="light.kind === 'directional'"
      :class="
        cn(
          'pointer-events-none absolute top-1/2 left-1/2 h-3 origin-left -translate-y-1/2 overflow-visible',
          selected ? 'opacity-100' : 'opacity-50'
        )
      "
      :style="{
        width: `${arrowLength}px`,
        rotate: `${light.direction}deg`
      }"
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1="20"
        y1="6"
        x2="88"
        y2="6"
        stroke="currentColor"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
      <path d="M86 0 L100 6 L86 12 Z" fill="currentColor" />
    </svg>
    <span
      v-if="selected"
      class="pointer-events-none absolute top-full left-1/2 mt-3.5 -translate-x-1/2 rounded-full bg-primary-comfy-ink/85 px-2 py-0.5 text-[10px] whitespace-nowrap text-primary-warm-white"
      aria-hidden="true"
      >{{ light.name }}</span
    >
  </button>
</template>
