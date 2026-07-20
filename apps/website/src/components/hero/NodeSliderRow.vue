<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed, ref } from 'vue'

const {
  label,
  min,
  max,
  step = 1,
  display,
  valueText,
  labelWidth,
  notch = false
} = defineProps<{
  label: string
  min: number
  max: number
  step?: number
  display: string
  valueText: string
  labelWidth?: string
  notch?: boolean
}>()

const model = defineModel<number>({ required: true })

const trackEl = ref<HTMLElement>()

const fill = computed(() =>
  Math.min(1, Math.max(0, (model.value - min) / (max - min)))
)

function quantize(value: number): number {
  const clamped = Math.min(max, Math.max(min, value))
  return Math.round(Math.round(clamped / step) * step * 1000) / 1000
}

function setFromClientX(clientX: number) {
  const track = trackEl.value
  if (!track) return
  const rect = track.getBoundingClientRect()
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

function nudge(delta: number) {
  model.value = quantize(model.value + delta)
}

function onKeydown(event: KeyboardEvent) {
  const map: Record<string, number> = {
    ArrowLeft: -step,
    ArrowDown: -step,
    ArrowRight: step,
    ArrowUp: step,
    PageDown: -step * 10,
    PageUp: step * 10
  }
  if (event.key === 'Home')
    return void ((model.value = min), event.preventDefault())
  if (event.key === 'End')
    return void ((model.value = max), event.preventDefault())
  const delta = map[event.key]
  if (delta === undefined) return
  event.preventDefault()
  nudge(delta)
}
</script>

<template>
  <div
    class="relative flex h-[1.625em] items-center gap-[0.625em] text-[0.75em]"
  >
    <span
      v-if="notch"
      class="bg-primary-comfy-ink-light absolute top-1/2 left-[-0.85em] h-[0.85em] w-[0.35em] -translate-y-1/2 rounded-[0.2em] border border-white/25"
    />
    <span :class="cn('shrink-0 text-white/60', labelWidth)">{{ label }}</span>
    <div
      ref="trackEl"
      role="slider"
      tabindex="0"
      :aria-label="label"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="model"
      :aria-valuetext="valueText"
      class="relative flex h-full min-w-0 flex-1 cursor-ew-resize touch-none items-center gap-[0.5em] overflow-hidden rounded-[0.375em] bg-black/25 px-[0.625em] outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/60"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @keydown="onKeydown"
    >
      <span
        class="pointer-events-none absolute inset-y-0 left-0 bg-[#3d4c63]"
        :style="{ width: `${fill * 100}%` }"
      />
      <button
        type="button"
        class="relative cursor-pointer text-white/40 hover:text-white/90"
        :aria-label="`Decrease ${label}`"
        @pointerdown.stop
        @click="nudge(-step)"
      >
        —
      </button>
      <span class="relative flex-1 truncate text-center text-white/90">
        {{ display }}
      </span>
      <button
        type="button"
        class="relative cursor-pointer text-white/40 hover:text-white/90"
        :aria-label="`Increase ${label}`"
        @pointerdown.stop
        @click="nudge(step)"
      >
        +
      </button>
    </div>
  </div>
</template>
