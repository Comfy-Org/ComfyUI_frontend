<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed, ref } from 'vue'

const { label, min, max, step, track, valueText, moving } = defineProps<{
  label: string
  min: number
  max: number
  step: number
  track: string
  valueText: string
  /** Shared in-motion signal from the parent. When several sliders are
   * driven together (the idle demo eases hue and saturation as one gesture)
   * the parent computes a single settle window so every overlay fades at the
   * same instant instead of each slider timing out on its own. */
  moving?: boolean
}>()

const model = defineModel<number>({ required: true })

const trackEl = ref<HTMLElement>()

const fraction = computed(() => (model.value - min) / (max - min))

/** The track dims while the value is in motion — a drag in progress, or the
 * idle demo driving it (reported by the parent via `moving`). */
const dragging = ref(false)

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
  dragging.value = true
  setFromClientX(event.clientX)
}

function onPointerMove(event: PointerEvent) {
  if (event.buttons === 0) return
  setFromClientX(event.clientX)
}

function onPointerUp() {
  dragging.value = false
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
      class="group relative h-[0.55em] w-full cursor-pointer touch-none rounded-full outline-none before:absolute before:inset-x-[-0.5em] before:inset-y-[-0.95em] before:content-[''] focus-visible:ring-2 focus-visible:ring-white/50"
      :style="{ background: track }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeydown"
    >
      <span
        :class="
          cn(
            'pointer-events-none absolute inset-0 rounded-full bg-primary-comfy-ink/70 transition-opacity duration-200',
            dragging || moving ? 'opacity-100' : 'opacity-0'
          )
        "
      />
      <span
        :class="
          cn(
            'pointer-events-none absolute top-1/2 size-[0.575em] -translate-1/2 rounded-full transition-colors duration-150',
            'group-hover:bg-primary-comfy-yellow bg-primary-comfy-canvas',
            (dragging || moving) && 'bg-primary-comfy-yellow'
          )
        "
        :style="{ left: `${fraction * 100}%` }"
      />
    </div>
  </div>
</template>
