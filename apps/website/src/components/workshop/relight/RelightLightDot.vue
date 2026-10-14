<script setup lang="ts">
import { computed, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Light } from '@/lib/workshop/relight/lights'
import { nudgeFor } from '@/lib/workshop/nudge'

const {
  light,
  label,
  selected,
  dragging = false
} = defineProps<{
  light: Light
  label: string
  selected: boolean
  dragging?: boolean
}>()

const emit = defineEmits<{
  grab: [event: PointerEvent]
  nudge: [dx: number, dy: number]
}>()

const beamId = useId()
const beamLength = computed(() => {
  const reach = Math.cos((light.elevation * Math.PI) / 180)
  return selected ? 22 + reach * 46 : 14 + reach * 24
})
const tagOnLeft = computed(
  () =>
    light.kind === 'directional' &&
    Math.cos((light.direction * Math.PI) / 180) > 0.3
)

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
        'group absolute grid size-8 -translate-1/2 cursor-move touch-none place-items-center rounded-full focus-visible:outline-none',
        selected && 'z-10',
        !light.visible && 'opacity-40'
      )
    "
    :style="{
      left: `${light.x * 100}%`,
      top: `${light.y * 100}%`,
      color: light.color
    }"
    @pointerdown="onGrab"
    @keydown="onKey"
  >
    <svg
      v-if="light.kind === 'directional'"
      :class="
        cn(
          'pointer-events-none absolute top-1/2 left-1/2 h-4 origin-left -translate-y-1/2 overflow-visible transition-opacity',
          selected ? 'opacity-90' : 'opacity-50 group-hover:opacity-80'
        )
      "
      :style="{ width: `${beamLength}px`, rotate: `${light.direction}deg` }"
      viewBox="0 0 100 16"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient :id="beamId" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.9" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 6.5 L100 0 L100 16 L0 9.5 Z" :fill="`url(#${beamId})`" />
    </svg>
    <span
      v-if="selected"
      class="pointer-events-none absolute size-7 rounded-full border border-primary-warm-white/60"
      aria-hidden="true"
    />
    <span
      :class="
        cn(
          'pointer-events-none relative rounded-full bg-current ring-2 transition-[width,height,box-shadow] group-focus-visible:outline-2 group-focus-visible:outline-offset-3 group-focus-visible:outline-primary-comfy-yellow',
          selected
            ? 'size-4 shadow-[0_0_16px_4px_currentColor] ring-primary-warm-white'
            : 'size-3 shadow-[0_0_8px_1px_currentColor] ring-primary-warm-white/80 group-hover:size-3.5'
        )
      "
      aria-hidden="true"
    />
    <span
      :class="
        cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-primary-comfy-ink/85 px-2 py-0.5 text-[10px] whitespace-nowrap text-primary-warm-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
          tagOnLeft ? 'right-full -mr-1' : 'left-full -ml-1',
          dragging && 'opacity-100'
        )
      "
      aria-hidden="true"
      >{{ light.name }}</span
    >
  </button>
</template>
