<template>
  <svg
    v-if="visible && debugInfo"
    :width="svgSize.width"
    :height="svgSize.height"
    :style="svgStyle"
    class="quadtree-visualization"
  >
    <!-- QuadTree boundaries -->
    <g v-for="(node, index) in flattenedNodes" :key="`quad-${index}`">
      <rect
        :x="node.bounds.x"
        :y="node.bounds.y"
        :width="node.bounds.width"
        :height="node.bounds.height"
        :stroke="getDepthColor(node.depth)"
        :stroke-width="getStrokeWidth(node.depth)"
        fill="none"
        :opacity="0.3 + node.depth * 0.05"
      />
    </g>

    <!-- Viewport bounds (optional) -->
    <rect
      v-if="viewportBounds"
      :x="viewportBounds.x"
      :y="viewportBounds.y"
      :width="viewportBounds.width"
      :height="viewportBounds.height"
      stroke="#00ff00"
      stroke-width="3"
      fill="none"
      stroke-dasharray="10,5"
      opacity="0.8"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Bounds } from '@/utils/spatial/QuadTree'

interface Props {
  visible: boolean
  debugInfo: any | null
  transformStyle: any
  viewportBounds?: Bounds
}

const props = defineProps<Props>()

// Flatten the tree structure for rendering
const flattenedNodes = computed(() => {
  if (!props.debugInfo?.tree) return []

  const nodes: any[] = []
  const traverse = (node: any, depth = 0) => {
    nodes.push({
      bounds: node.bounds,
      depth,
      itemCount: node.itemCount,
      divided: node.divided
    })

    if (node.children) {
      node.children.forEach((child: any) => traverse(child, depth + 1))
    }
  }

  traverse(props.debugInfo.tree)
  return nodes
})

// SVG size (matches the transform pane size)
const svgSize = ref({ width: 20000, height: 20000 })

// Apply the same transform as the TransformPane
const svgStyle = computed(() => ({
  ...props.transformStyle,
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none'
}))

// Color based on depth
const getDepthColor = (depth: number): string => {
  const colors = [
    '#ff6b6b', // Red
    '#ffa500', // Orange
    '#ffd93d', // Yellow
    '#6bcf7f', // Green
    '#4da6ff', // Blue
    '#a78bfa' // Purple
  ]
  return colors[depth % colors.length]
}

// Stroke width based on depth
const getStrokeWidth = (depth: number): number => {
  return Math.max(0.5, 2 - depth * 0.3)
}
</script>

<style scoped>
.quadtree-visualization {
  position: absolute;
  overflow: visible;
  z-index: 10; /* Above nodes but below UI */
}
</style>
