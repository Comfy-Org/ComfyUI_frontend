<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  modelValue,
  min = 0,
  max = 100,
  step = 1,
  class: className
} = defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  class?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const root = useTemplateRef('root')

const progress = computed(() =>
  max === min ? 0 : (modelValue - min) / (max - min)
)
const dashOffset = computed(() => 75 * (1 - progress.value))

function setValue(value: number) {
  const stepped = Math.round((value - min) / step) * step + min
  emit('update:modelValue', Math.min(max, Math.max(min, stepped)))
}

function updateFromPointer(event: PointerEvent) {
  const bounds = root.value?.getBoundingClientRect()
  if (!bounds) return

  const x = event.clientX - bounds.left - bounds.width / 2
  const y = event.clientY - bounds.top - bounds.height / 2
  const angle = (Math.atan2(y, x) * 180) / Math.PI
  const clockwise = (angle + 225 + 360) % 360
  const position =
    clockwise > 315 ? (clockwise < 337.5 ? 1 : 0) : clockwise / 270
  setValue(min + position * (max - min))
}

function onPointerDown(event: PointerEvent) {
  root.value?.setPointerCapture(event.pointerId)
  updateFromPointer(event)
}

function onKeydown(event: KeyboardEvent) {
  const direction =
    event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -1
        : 0
  if (!direction) return
  event.preventDefault()
  setValue(modelValue + direction * step)
}
</script>

<template>
  <div
    ref="root"
    role="slider"
    tabindex="0"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    :class="cn('size-12 cursor-pointer touch-none outline-none', className)"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="(event) => event.buttons === 1 && updateFromPointer(event)"
  >
    <svg viewBox="0 0 32 32" class="size-full rotate-[-225deg]">
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-dasharray="75 25"
        class="text-node-stroke"
      />
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="75 100"
        :stroke-dashoffset="dashOffset"
        class="text-node-component-surface-highlight"
      />
    </svg>
  </div>
</template>
