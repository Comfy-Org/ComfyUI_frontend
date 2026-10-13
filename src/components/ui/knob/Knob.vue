<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  class: className
} = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
  max?: number
  min?: number
  step?: number
}>()

const modelValue = defineModel<number>({ required: true })
const root = useTemplateRef('root')

const progress = computed(() =>
  max === min ? 0 : (modelValue.value - min) / (max - min)
)
const dashOffset = computed(() => 75 * (1 - progress.value))

function setValue(value: number) {
  if (disabled) return
  const stepped = step ? Math.round((value - min) / step) * step + min : value
  modelValue.value = Math.min(max, Math.max(min, stepped))
}

function updateFromPointer(event: PointerEvent) {
  const bounds = root.value?.getBoundingClientRect()
  if (!bounds) return

  const x = event.clientX - bounds.left - bounds.width / 2
  const y = event.clientY - bounds.top - bounds.height / 2
  const angle = (Math.atan2(y, x) * 180) / Math.PI
  const clockwise = (angle + 225 + 360) % 360
  const position = clockwise > 315 ? 0 : clockwise / 270
  setValue(min + position * (max - min))
}

function onPointerDown(event: PointerEvent) {
  root.value?.setPointerCapture(event.pointerId)
  updateFromPointer(event)
}

function keyboardTarget(key: string): number | undefined {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return modelValue.value + step
    case 'ArrowDown':
    case 'ArrowLeft':
      return modelValue.value - step
    case 'PageUp':
      return modelValue.value + 10 * step
    case 'PageDown':
      return modelValue.value - 10 * step
    case 'Home':
      return min
    case 'End':
      return max
  }
}

function onKeydown(event: KeyboardEvent) {
  const target = keyboardTarget(event.key)
  if (target === undefined) return
  event.preventDefault()
  setValue(target)
}
</script>

<template>
  <div
    ref="root"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    :aria-disabled="disabled || undefined"
    :class="
      cn(
        'size-12 cursor-pointer touch-none outline-none',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )
    "
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="
      (event) =>
        root?.hasPointerCapture(event.pointerId) && updateFromPointer(event)
    "
  >
    <svg viewBox="0 0 32 32" class="size-full rotate-[-225deg]">
      <circle
        data-testid="knob-track"
        cx="16"
        cy="16"
        r="12"
        pathLength="100"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-dasharray="75 25"
        class="text-secondary-background"
      />
      <circle
        data-testid="knob-value"
        cx="16"
        cy="16"
        r="12"
        pathLength="100"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="75 100"
        :stroke-dashoffset="dashOffset"
        class="text-primary-background"
      />
    </svg>
  </div>
</template>
