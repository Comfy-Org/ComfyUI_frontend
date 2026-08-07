<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'

import { computed, ref } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { ElementKey } from './graphLayout'
import { FLOW, PORTS, portPoint } from './graphLayout'

const { positions } = defineProps<{
  positions: Record<ElementKey, { x: number; y: number }>
}>()

const svgEl = ref<SVGSVGElement>()
const onScreen = useElementVisibility(svgEl)

/** Wires sag and sway like hanging cable: each control point droops a little
 * and drifts on its own slow sine so the three wires never move in unison.
 * Subtle by design — a few SVG units of travel at ~0.1–0.2 Hz. */
const time = ref(0)

useRafFn(({ delta }) => {
  if (!onScreen.value || prefersReducedMotion()) return
  time.value += Math.min(delta, 100) / 1000
})

const SAG = 6
const SWAY = 3.5

// Every endpoint has a DOM dot on its element (input card, node headers, the
// OUTPUT pill), so the splines carry no dots of their own. The layer renders
// beneath the nodes, so wires dip under elements they cross.
const links = computed(() => {
  const pairs = [
    [PORTS.inputOut, PORTS.angleIn],
    [PORTS.angleOut, PORTS.colorIn],
    [PORTS.colorOut, PORTS.outputIn]
  ] as const
  const t = time.value
  return pairs.map(([from, to], i) => {
    const a = portPoint(from, positions)
    const b = portPoint(to, positions)
    const x1 = a.x * 10
    const y1 = a.y * 10
    const x2 = b.x * 10
    const y2 = b.y * 10
    const d = Math.max(30, Math.abs(x2 - x1) * 0.5)
    // Two slightly detuned oscillators per wire read as swing rather than pulse.
    const swing1 = Math.sin(t * 0.9 + i * 2.1) * SWAY
    const swing2 = Math.sin(t * 0.7 + i * 2.1 + 1.4) * SWAY
    const droop = SAG + Math.sin(t * 0.5 + i * 1.7) * (SAG * 0.25)
    return `M ${x1} ${y1} C ${x1 + d} ${y1 + droop + swing1}, ${x2 - d} ${y2 + droop + swing2}, ${x2} ${y2}`
  })
})
</script>

<template>
  <svg
    ref="svgEl"
    class="pointer-events-none absolute inset-0 size-full overflow-visible"
    :viewBox.attr="`0 0 ${FLOW.canvas.width * 10} ${FLOW.canvas.height * 10}`"
    preserveAspectRatio="none"
    fill="none"
    aria-hidden="true"
  >
    <path
      v-for="(d, i) in links"
      :key="i"
      :d="d"
      stroke="#f2ff59"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
    <!-- Traveling pulses: a dashed twin of each wire whose offset advances
         so light appears to flow from input to output. -->
    <path
      v-for="(d, i) in links"
      :key="`flow-${i}`"
      :d="d"
      class="wire-flow"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.wire-flow {
  stroke: #fff;
  stroke-linecap: round;
  stroke-dasharray: 14 106;
  opacity: 0.9;
}

@media (prefers-reduced-motion: no-preference) {
  .wire-flow {
    animation: wire-flow 2.4s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wire-flow {
    display: none;
  }
}

/* Decreasing offset pushes the dash toward the path's end — left to right. */
@keyframes wire-flow {
  from {
    stroke-dashoffset: 120;
  }

  to {
    stroke-dashoffset: 0;
  }
}
</style>
