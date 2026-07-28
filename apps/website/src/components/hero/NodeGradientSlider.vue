<script setup lang="ts">
import { computed, ref } from 'vue'

const { label, min, max, step, track, valueText } = defineProps<{
  label: string
  min: number
  max: number
  step: number
  track: string
  valueText: string
}>()

const model = defineModel<number>({ required: true })

const trackEl = ref<HTMLElement>()

const fraction = computed(() => (model.value - min) / (max - min))

function quantize(value: number): number {
  const clamped = Math.min(max, Math.max(min, value))
  return Math.round(clamped / step) * step
}

function setFromClientX(clientX: number) {
  const el = trackEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  model.value = quantize(
    min + ((clientX - rect.left) / rect.width) * (max - min)
  )
}

function onPointerDown(event: PointerEvent) {
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  setFromClientX(event.clientX)
}

function onPointerMove(event: PointerEvent) {
  if (event.buttons === 0) return
  setFromClientX(event.clientX)
}

function onKeydown(event: KeyboardEvent) {
  const direction =
    event.key === 'ArrowLeft' || event.key === 'ArrowDown'
      ? -1
      : event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : 0
  if (direction === 0) return
  event.preventDefault()
  model.value = quantize(
    model.value + direction * step * (event.shiftKey ? 5 : 1)
  )
}
</script>

<template>
  <div class="flex w-full flex-col gap-[0.45em]">
    <span
      class="font-formula text-[0.65em] leading-[1.1] font-bold tracking-[-0.01em] text-primary-comfy-canvas"
    >
      {{ label }}
    </span>
    <div
      ref="trackEl"
      role="slider"
      tabindex="0"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="model"
      :aria-valuetext="valueText"
      class="relative h-[0.55em] w-full cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      :style="{ background: track }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @keydown="onKeydown"
    >
      <span
        class="pointer-events-none absolute top-1/2 size-[0.575em] -translate-1/2 rounded-full bg-primary-comfy-canvas"
        :style="{ left: `${fraction * 100}%` }"
      />
    </div>
  </div>
</template>
