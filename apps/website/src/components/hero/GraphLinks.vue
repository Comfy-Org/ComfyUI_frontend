<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'

import { computed, onMounted, ref, watch } from 'vue'

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

/** Comet geometry: SEG_LEN-long dashes stacked TRAIL deep, with opacity
 * ramping 1 → 0 so the head reads solid and the tail dissolves, matching the
 * showcase frame's sweep. The dash cycle is each wire's own length and the
 * duration scales with it, so a short wire gets the same size pulse at the
 * same speed as a long one rather than a squashed cycle. */
const TRAIL = 14
const SEG_LEN = 3
/** Path units per second. */
const SPEED = 70

function trailOpacity(seg: number): number {
  return Math.round((1 - seg / TRAIL) ** 1.8 * 100) / 100
}

/** Measured once per layout: sway shifts control points but barely changes
 * arc length, so re-measuring every frame would burn layout for nothing. */
const basePaths = ref<SVGPathElement[]>([])
const lengths = ref<number[]>([])

function measure() {
  lengths.value = basePaths.value.map((p) => p?.getTotalLength?.() ?? 0)
}

onMounted(measure)
watch(() => positions, measure, { deep: true, flush: 'post' })

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
      :ref="(el) => (basePaths[i] = el as SVGPathElement)"
      :d="d"
      stroke="#f2ff59"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
    <!-- Traveling comet: each wire carries a stack of short dashes trailing
         the head, their opacity ramping 100% → 0% like the conic sweep on the
         showcase frame. One shared keyframe moves them all; the per-segment
         dash offset is what spaces the tail out behind the head. -->
    <template v-for="(d, i) in links" :key="`flow-${i}`">
      <path
        v-for="seg in TRAIL"
        :key="`flow-${i}-${seg}`"
        :d="d"
        class="wire-flow"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        :style="{
          opacity: trailOpacity(seg),
          strokeDasharray: `${SEG_LEN} ${Math.max(1, (lengths[i] ?? 0) - SEG_LEN)}`,
          animationDuration: `${Math.max(0.6, (lengths[i] ?? 0) / SPEED)}s`,
          '--seg-shift': seg * SEG_LEN,
          '--cycle': lengths[i] ?? 0
        }"
      />
    </template>
  </svg>
</template>

<style scoped>
.wire-flow {
  stroke: #fff;
  stroke-linecap: round;
}

@media (prefers-reduced-motion: no-preference) {
  .wire-flow {
    /* Duration is set inline, scaled to each wire's measured length. */
    animation-name: wire-flow;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wire-flow {
    display: none;
  }
}

/* Decreasing offset pushes the dash toward the path's end — left to right.
   --seg-shift holds each segment that much further back along the wire, so
   the stack reads as one comet with a fading tail. */
@keyframes wire-flow {
  from {
    stroke-dashoffset: calc(var(--cycle) + var(--seg-shift));
  }

  to {
    stroke-dashoffset: var(--seg-shift);
  }
}
</style>
