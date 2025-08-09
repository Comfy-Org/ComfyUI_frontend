<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="pt-2 border-t border-surface-200 dark-theme:border-surface-700">
    <h4 class="font-semibold mb-1">QuadTree Spatial Index</h4>

    <!-- Enable/Disable Toggle -->
    <div class="mb-2">
      <label class="flex items-center gap-2">
        <input
          :checked="enabled"
          type="checkbox"
          @change="$emit('toggle', ($event.target as HTMLInputElement).checked)"
        />
        <span>Enable Spatial Indexing</span>
      </label>
    </div>

    <!-- Status Message -->
    <p v-if="!enabled" class="text-muted text-xs italic">
      {{ statusMessage }}
    </p>

    <!-- Metrics when enabled -->
    <template v-if="enabled && metrics">
      <p class="text-muted">Strategy: {{ strategy }}</p>
      <p class="text-muted">Total Nodes: {{ metrics.totalNodes }}</p>
      <p class="text-muted">Visible Nodes: {{ metrics.visibleNodes }}</p>
      <p class="text-muted">Query Time: {{ metrics.queryTime.toFixed(2) }}ms</p>
      <p class="text-muted">Tree Depth: {{ metrics.treeDepth }}</p>
      <p class="text-muted">Culling Efficiency: {{ cullingEfficiency }}</p>
      <p class="text-muted">Rebuilds: {{ metrics.rebuildCount }}</p>

      <!-- Show debug visualization toggle -->
      <div class="mt-2">
        <label class="flex items-center gap-2">
          <input
            :checked="showVisualization"
            type="checkbox"
            @change="
              $emit(
                'toggle-visualization',
                ($event.target as HTMLInputElement).checked
              )
            "
          />
          <span>Show QuadTree Boundaries</span>
        </label>
      </div>
    </template>

    <!-- Performance Comparison -->
    <template v-if="enabled && performanceComparison">
      <div class="mt-2 text-xs">
        <p class="text-muted font-semibold">Performance vs Linear:</p>
        <p class="text-muted">Speedup: {{ performanceComparison.speedup }}x</p>
        <p class="text-muted">
          Break-even: ~{{ performanceComparison.breakEvenNodeCount }} nodes
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  enabled: boolean
  metrics?: {
    totalNodes: number
    visibleNodes: number
    queryTime: number
    treeDepth: number
    rebuildCount: number
  }
  strategy?: string
  threshold?: number
  showVisualization?: boolean
  performanceComparison?: {
    speedup: number
    breakEvenNodeCount: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  metrics: undefined,
  strategy: 'quadtree',
  threshold: 100,
  showVisualization: false,
  performanceComparison: undefined
})

defineEmits<{
  toggle: [enabled: boolean]
  'toggle-visualization': [show: boolean]
}>()

const statusMessage = computed(() => {
  if (!props.enabled && props.metrics) {
    return `Disabled (threshold: ${props.threshold} nodes, current: ${props.metrics.totalNodes})`
  }
  return `Spatial indexing will enable at ${props.threshold}+ nodes`
})

const cullingEfficiency = computed(() => {
  if (!props.metrics || props.metrics.totalNodes === 0) return 'N/A'

  const culled = props.metrics.totalNodes - props.metrics.visibleNodes
  const percentage = ((culled / props.metrics.totalNodes) * 100).toFixed(1)
  return `${culled} nodes (${percentage}%)`
})
</script>
