<script setup lang="ts">
import type { GraphNode } from '../../lib/hub/workflow-graph'

const { node } = defineProps<{ node: GraphNode }>()

const TITLE_BAR = 24
const CORNER = 10

/** The header, drawn as a rounded top rather than a clipped rectangle. */
const header = (n: GraphNode) =>
  `M ${n.x} ${n.y + CORNER} a ${CORNER} ${CORNER} 0 0 1 ${CORNER} ${-CORNER} h ${n.width - CORNER * 2} a ${CORNER} ${CORNER} 0 0 1 ${CORNER} ${CORNER} v ${TITLE_BAR} h ${-n.width} z`
</script>

<template>
  <g>
    <rect
      :x="node.x"
      :y="node.y"
      :width="node.width"
      :height="node.height"
      rx="10"
      fill="#1e1e22"
      stroke="#ffffff1f"
    />
    <path :d="header(node)" :fill="node.accent" fill-opacity="0.28" />
    <text
      :x="node.x + 12"
      :y="node.y + 22"
      fill="#f5f5f5"
      font-size="14"
      font-weight="600"
    >
      {{ node.title }}
    </text>

    <g v-for="slot in node.inputs" :key="`in-${slot.name}-${slot.y}`">
      <circle :cx="node.x" :cy="node.y + slot.y" r="4.5" :fill="slot.color" />
      <text
        :x="node.x + 12"
        :y="node.y + slot.y + 4"
        fill="#c9c9c9"
        font-size="11"
      >
        {{ slot.name }}
      </text>
    </g>

    <g v-for="slot in node.outputs" :key="`out-${slot.name}-${slot.y}`">
      <circle
        :cx="node.x + node.width"
        :cy="node.y + slot.y"
        r="4.5"
        :fill="slot.color"
      />
      <text
        :x="node.x + node.width - 12"
        :y="node.y + slot.y + 4"
        fill="#c9c9c9"
        font-size="11"
        text-anchor="end"
      >
        {{ slot.name }}
      </text>
    </g>
  </g>
</template>
