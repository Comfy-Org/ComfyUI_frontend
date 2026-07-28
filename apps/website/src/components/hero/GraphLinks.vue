<script setup lang="ts">
import { computed } from 'vue'

import type { ElementKey } from './graphLayout'
import { FLOW, PORTS, portPoint } from './graphLayout'

const { positions } = defineProps<{
  positions: Record<ElementKey, { x: number; y: number }>
}>()

// Every endpoint has a DOM dot on its element (input card, node headers, the
// OUTPUT pill), so the splines carry no dots of their own. The layer renders
// beneath the nodes, so wires dip under elements they cross.
const links = computed(() => {
  const pairs = [
    [PORTS.inputOut, PORTS.angleIn],
    [PORTS.angleOut, PORTS.colorIn],
    [PORTS.colorOut, PORTS.outputIn]
  ] as const
  return pairs.map(([from, to]) => {
    const a = portPoint(from, positions)
    const b = portPoint(to, positions)
    const x1 = a.x * 10
    const y1 = a.y * 10
    const x2 = b.x * 10
    const y2 = b.y * 10
    const d = Math.max(30, Math.abs(x2 - x1) * 0.5)
    return `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`
  })
})
</script>

<template>
  <svg
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
  </svg>
</template>
