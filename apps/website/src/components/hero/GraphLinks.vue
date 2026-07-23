<script setup lang="ts">
import { computed } from 'vue'

import type { ElementKey } from './graphLayout'
import { FLOW, PORTS, portPoint } from './graphLayout'

const { positions } = defineProps<{
  positions: Record<ElementKey, { x: number; y: number }>
}>()

const links = computed(() => {
  // The OUTPUT pill draws its own dot, so that wire end gets none here.
  const pairs = [
    { from: PORTS.inputOut, to: PORTS.angleIn, dotAtEnd: true },
    { from: PORTS.angleOut, to: PORTS.colorIn, dotAtEnd: true },
    { from: PORTS.colorOut, to: PORTS.outputIn, dotAtEnd: false }
  ]
  return pairs.map(({ from, to, dotAtEnd }) => {
    const a = portPoint(from, positions)
    const b = portPoint(to, positions)
    const x1 = a.x * 10
    const y1 = a.y * 10
    const x2 = b.x * 10
    const y2 = b.y * 10
    const d = Math.max(30, Math.abs(x2 - x1) * 0.5)
    const dots = [{ cx: x1, cy: y1 }]
    if (dotAtEnd) dots.push({ cx: x2, cy: y2 })
    return {
      path: `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`,
      dots
    }
  })
})
</script>

<template>
  <svg
    class="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
    :viewBox.attr="`0 0 ${FLOW.canvas.width * 10} ${FLOW.canvas.height * 10}`"
    preserveAspectRatio="none"
    fill="none"
    aria-hidden="true"
  >
    <g v-for="(link, i) in links" :key="i">
      <path
        :d="link.path"
        stroke="#f2ff59"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
      <circle
        v-for="(dot, j) in link.dots"
        :key="j"
        :cx="dot.cx"
        :cy="dot.cy"
        r="2.75"
        fill="#f2ff59"
      />
    </g>
  </svg>
</template>
