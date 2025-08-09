<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <!-- TransformPane Debug Controls -->
  <div
    class="fixed top-20 right-4 bg-surface-0 dark-theme:bg-surface-800 p-4 rounded-lg shadow-lg border border-surface-300 dark-theme:border-surface-600 z-50 pointer-events-auto w-80"
    style="contain: layout style"
  >
    <h3 class="font-bold mb-2 text-sm">TransformPane Debug</h3>
    <div class="space-y-2 text-xs">
      <div>
        <label class="flex items-center gap-2">
          <input v-model="debugOverrideVueNodes" type="checkbox" />
          <span>Enable TransformPane</span>
        </label>
      </div>

      <!-- Canvas Metrics -->
      <div
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Canvas State</h4>
        <p class="text-muted">
          Status: {{ canvasStore.canvas ? 'Ready' : 'Not Ready' }}
        </p>
        <p class="text-muted">
          Viewport: {{ Math.round(canvasViewport.width) }}x{{
            Math.round(canvasViewport.height)
          }}
        </p>
        <template v-if="canvasStore.canvas?.ds">
          <p class="text-muted">
            Offset: ({{ Math.round(canvasStore.canvas.ds.offset[0]) }},
            {{ Math.round(canvasStore.canvas.ds.offset[1]) }})
          </p>
          <p class="text-muted">
            Scale: {{ canvasStore.canvas.ds.scale?.toFixed(3) || 1 }}
          </p>
        </template>
      </div>

      <!-- Node Metrics -->
      <div
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Graph Metrics</h4>
        <p class="text-muted">
          Total Nodes: {{ comfyApp.graph?.nodes?.length || 0 }}
        </p>
        <p class="text-muted">
          Selected Nodes: {{ canvasStore.canvas?.selectedItems?.size || 0 }}
        </p>
        <p class="text-muted">Vue Nodes Rendered: {{ vueNodesCount }}</p>
        <p class="text-muted">Nodes in Viewport: {{ nodesInViewport }}</p>
        <p class="text-muted">
          Culled Nodes: {{ performanceMetrics.culledCount }}
        </p>
        <p class="text-muted">
          Cull Percentage:
          {{
            Math.round(
              ((vueNodesCount - nodesInViewport) / Math.max(vueNodesCount, 1)) *
                100
            )
          }}%
        </p>
      </div>

      <!-- Performance Metrics -->
      <div
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Performance</h4>
        <p v-memo="[currentFPS]" class="text-muted">FPS: {{ currentFPS }}</p>
        <p v-memo="[Math.round(lastTransformTime)]" class="text-muted">
          Transform Update: {{ Math.round(lastTransformTime) }}ms
        </p>
        <p
          v-memo="[Math.round(performanceMetrics.updateTime)]"
          class="text-muted"
        >
          Lifecycle Update: {{ Math.round(performanceMetrics.updateTime) }}ms
        </p>
        <p v-memo="[rafActive]" class="text-muted">
          RAF Active: {{ rafActive ? 'Yes' : 'No' }}
        </p>
        <p v-memo="[performanceMetrics.adaptiveQuality]" class="text-muted">
          Adaptive Quality:
          {{ performanceMetrics.adaptiveQuality ? 'On' : 'Off' }}
        </p>
      </div>

      <!-- Feature Flags Status -->
      <div
        v-if="isDevModeEnabled"
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Feature Flags</h4>
        <p class="text-muted text-xs">
          Vue Nodes: {{ shouldRenderVueNodes ? 'Enabled' : 'Disabled' }}
        </p>
        <p class="text-muted text-xs">
          Dev Mode: {{ isDevModeEnabled ? 'Enabled' : 'Disabled' }}
        </p>
      </div>

      <!-- Performance Options -->
      <div
        v-if="transformPaneEnabled"
        class="pt-2 border-t border-surface-200 dark-theme:border-surface-700"
      >
        <h4 class="font-semibold mb-1">Debug Options</h4>
        <label class="flex items-center gap-2">
          <input v-model="showPerformanceOverlay" type="checkbox" />
          <span>Show Performance Overlay</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { app as comfyApp } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'

interface Props {
  debugOverrideVueNodes: boolean
  canvasViewport: { width: number; height: number }
  vueNodesCount: number
  nodesInViewport: number
  performanceMetrics: {
    culledCount: number
    updateTime: number
    adaptiveQuality: boolean
  }
  currentFPS: number
  lastTransformTime: number
  rafActive: boolean
  isDevModeEnabled: boolean
  shouldRenderVueNodes: boolean
  transformPaneEnabled: boolean
  showPerformanceOverlay: boolean
}

interface Emits {
  (e: 'update:debugOverrideVueNodes', value: boolean): void
  (e: 'update:showPerformanceOverlay', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const canvasStore = useCanvasStore()

const debugOverrideVueNodes = computed({
  get: () => props.debugOverrideVueNodes,
  set: (value: boolean) => emit('update:debugOverrideVueNodes', value)
})

const showPerformanceOverlay = computed({
  get: () => props.showPerformanceOverlay,
  set: (value: boolean) => emit('update:showPerformanceOverlay', value)
})
</script>
