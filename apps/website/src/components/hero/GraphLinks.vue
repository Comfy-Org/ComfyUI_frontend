<script setup lang="ts">
import { computed } from 'vue'

import type { PortType } from './graphChrome'
import { PORT_COLORS } from './graphChrome'
import type { NodeKey } from './graphLayout'
import { GRAPH, portY } from './graphLayout'

const { positions, collapsed } = defineProps<{
  positions: Record<NodeKey, { x: number; y: number }>
  collapsed: Record<NodeKey, boolean>
}>()

interface LinkSpec {
  from: NodeKey
  fromRow: number
  to: NodeKey
  toRow: number
  type: PortType
  bow?: number
}

const LINK_SPECS: LinkSpec[] = [
  { from: 'load', fromRow: 0, to: 'camera', toRow: 0, type: 'IMAGE' },
  { from: 'load', fromRow: 0, to: 'edit', toRow: 0, type: 'IMAGE' },
  { from: 'camera', fromRow: 0, to: 'edit', toRow: 3, type: 'STRING', bow: 18 },
  { from: 'edit', fromRow: 0, to: 'save', toRow: 0, type: 'IMAGE' }
]

const links = computed(() =>
  LINK_SPECS.map((spec) => {
    const from = positions[spec.from]
    const to = positions[spec.to]
    const x1 = (from.x + GRAPH.nodes[spec.from].width) * 10
    const y1 = portY(from.y, spec.fromRow, collapsed[spec.from]) * 10
    const x2 = to.x * 10
    const y2 = portY(to.y, spec.toRow, collapsed[spec.to]) * 10
    const d = spec.bow ?? Math.min(60, Math.max(15, Math.abs(x2 - x1) / 2))
    return {
      type: spec.type,
      path: `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`
    }
  })
)
</script>

<template>
  <svg
    class="absolute inset-0 size-full"
    :viewBox.attr="`0 0 ${GRAPH.canvas.width * 10} ${GRAPH.canvas.height * 10}`"
    preserveAspectRatio="none"
    fill="none"
    aria-hidden="true"
  >
    <path
      v-for="(link, i) in links"
      :key="i"
      :d="link.path"
      :stroke="PORT_COLORS[link.type]"
      stroke-opacity="0.55"
      stroke-width="1.6"
    />
  </svg>
</template>
