<script setup lang="ts">
import { computed } from 'vue'

import type { ScrubState } from './useScrubValue'

const {
  state,
  width,
  min,
  max,
  hasBar = false
} = defineProps<{
  state: Readonly<ScrubState>
  /** Container width in *logical* CSS pixels (post-zoom dimensions divided by zoom). */
  width: number
  min: number
  max: number
  /** Anchor mode: bar mode pins a ball to the handle; free mode pins to center at value=0. */
  hasBar?: boolean
}>()

function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const dashOffset = computed(() =>
  hasBar
    ? ((state.value - min) / (max - min)) * width
    : width / 2 - state.value / state.speedMult
)

const layers = computed(() =>
  Array.from({ length: 3 }, (_, i) => {
    const precision = mod(-Math.log10(state.speedMult) + i, 3)
    return {
      precision,
      gap: Math.pow(10, precision),
      opacity: Math.pow(smoothstep(1, 2, precision), 0.5)
    }
  }).filter((layer) => layer.opacity >= 0.01)
)
</script>

<template>
  <svg
    class="pointer-events-none absolute inset-0 size-full overflow-hidden rounded-lg"
    aria-hidden="true"
  >
    <line
      v-for="layer in layers"
      :key="layer.precision"
      :x1="0"
      :x2="width"
      y1="50%"
      y2="50%"
      fill="none"
      stroke-linecap="round"
      :stroke="`color-mix(in srgb, var(--p-primary-color), var(--p-text-muted-color) ${state.weight * 100}%)`"
      :stroke-width="4 - state.weight"
      :stroke-dasharray="`0 ${layer.gap}`"
      :stroke-dashoffset="-dashOffset"
      :opacity="layer.opacity"
    />
  </svg>
</template>
