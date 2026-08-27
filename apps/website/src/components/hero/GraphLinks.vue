<script setup lang="ts">
import { useElementVisibility, useRafFn } from '@vueuse/core'

import { computed, onMounted, ref, useId, watch } from 'vue'

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

/* ------------------------------------------------------------------------ *
 * Travelling sweep
 *
 * Matches `animate-border-spin` on the showcase frame, which is a conic
 * gradient ramping brand yellow 4% → 100% across the *whole* perimeter and
 * rotating once every 2s. The important property is that no part of the
 * border is ever dark: it is one continuous ramp with a single hard seam that
 * travels. So this is not a comet on an unlit wire — the ramp spans the wire
 * end to end, and the base stroke sits underneath at low opacity because in
 * the reference the gradient *is* the border.
 *
 * Built from bands of a dashed stroke rather than a paint gradient: a
 * <linearGradient> projects onto its axis, which is chord distance, not arc
 * length — on these curves that runs the ramp up to 3.9x faster on the flat
 * sections than the steep ones. Dashes are laid out along the path itself, so
 * they are arc-length correct for free.
 * ------------------------------------------------------------------------ */

/** Declared on every band so dash maths runs in normalised units. The wires
 * sway a little every frame, which changes true arc length; normalising means
 * the dash pattern cannot breathe or drift in phase with it. */
const PATH_UNITS = 100

/** Bands per wrap. The alpha step between neighbours has to stay under the
 * Mach-banding threshold — 32 gives ~3%, which reads as a smooth ramp. */
const BANDS = 32

/** Target arc length of one wrap, in viewBox units. Each wire rounds to a
 * whole number of wraps, so all three sweep at near-identical linear speed
 * instead of the short wire getting a squashed cycle. Set well above the
 * longest wire (~158) so every wire carries exactly one ramp end to end,
 * like the single gradient wrapping the reference's border. */
const WRAP_UNITS = 400

/** One wrap takes this long on every wire. Matches the 2s rotation of
 * `animate-border-spin`. */
const SWEEP_MS = 2000

/** Floor of the ramp, mirroring the reference's `yellow 4%`. */
const RAMP_FLOOR = 0.04

/** Linear, like the conic. A gamma curve here is what made the old falloff
 * read wrong. Band 0 is the head. */
function bandOpacity(band: number): number {
  const s = band / (BANDS - 1)
  return Math.round((1 - s * (1 - RAMP_FLOOR)) * 1000) / 1000
}

const bands = Array.from({ length: BANDS }, (_, i) => i)

/** Measured once per layout off the *base* path, which carries no pathLength
 * attribute — engines disagree on whether getTotalLength honours it. Only
 * feeds the integer wrap count, so a little imprecision is harmless. */
const basePaths = ref<SVGPathElement[]>([])
const wraps = ref<number[]>([1, 1, 1])

function measure() {
  wraps.value = basePaths.value.map((p) =>
    Math.max(1, Math.round((p?.getTotalLength?.() ?? WRAP_UNITS) / WRAP_UNITS))
  )
}

onMounted(measure)
watch(() => positions, measure, { deep: true, flush: 'post' })

const uid = useId()
const geoId = (i: number) => `hero-wire-${uid}-${i}`

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

/** Dash geometry per wire, in normalised units. */
const sweeps = computed(() =>
  links.value.map((_, i) => {
    const period = PATH_UNITS / (wraps.value[i] ?? 1)
    const band = period / BANDS
    return { period, band }
  })
)
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
    <!-- Shared geometry for the sweep bands. Carries no stroke properties of
         its own: values set here would beat the ones inherited from <use>,
         which would silently blank the whole sweep. -->
    <defs>
      <path
        v-for="(d, i) in links"
        :id="geoId(i)"
        :key="`geo-${i}`"
        :d="d"
        :pathLength="PATH_UNITS"
      />
    </defs>

    <!-- Base wire. Dim, because the sweep supplies the brightness — the
         reference has no always-on border underneath its gradient. -->
    <path
      v-for="(d, i) in links"
      :key="`base-${i}`"
      :ref="(el) => (basePaths[i] = el as SVGPathElement)"
      :d="d"
      stroke="#f2ff59"
      stroke-width="1.5"
      stroke-opacity="0.22"
      vector-effect="non-scaling-stroke"
    />

    <!-- Sweep. One <use> per band, all cloning the geometry above, so the rAF
         loop writes 6 `d` attributes a frame rather than one per band. The
         viewBox and canvas share an aspect ratio, so plain user-unit strokes
         scale uniformly and `vector-effect` is unnecessary here — it is also
         underspecified in combination with dashing. -->
    <g class="wire-sweep">
      <template v-for="(d, i) in links" :key="`sweep-${i}`">
        <use
          v-for="band in bands"
          :key="`sweep-${i}-${band}`"
          :href="`#${geoId(i)}`"
          :style="{
            strokeOpacity: bandOpacity(band),
            strokeDasharray: `${sweeps[i].band} ${sweeps[i].period - sweeps[i].band}`,
            animationDuration: `${SWEEP_MS}ms`,
            '--period': sweeps[i].period,
            '--phase': band * sweeps[i].band
          }"
        />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.wire-sweep use {
  stroke: #f2ff59;
  /* User units, not non-scaling-stroke: dashing plus device-space strokes is
     underspecified, and the canvas scales uniformly so this is equivalent. */
  stroke-width: 1;
  /* Butt caps abut exactly. Round caps extend each band by half the stroke
     width at both ends, so neighbours bulge and overlap unevenly. */
  stroke-linecap: butt;
}

@media (prefers-reduced-motion: no-preference) {
  .wire-sweep use {
    animation-name: wire-sweep;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wire-sweep {
    display: none;
  }
}

/* Decreasing offset carries the band forward — input to output. Each band
   starts one band-length further back, so the stack reads as one ramp. */
@keyframes wire-sweep {
  from {
    stroke-dashoffset: calc((var(--period) + var(--phase)) * 1px);
  }

  to {
    stroke-dashoffset: calc(var(--phase) * 1px);
  }
}
</style>
