<template>
  <div
    class="vue-node-overlay absolute inset-0 pointer-events-none overflow-hidden"
  >
    <VueNode
      v-for="node in phantomNodes"
      :key="node.id"
      :node="node"
      :selected="isNodeSelected(node.id)"
      :executing="isNodeExecuting(node.id)"
      :canvas-scale="canvasScale"
      :canvas-offset="canvasOffset"
      :update-trigger="graphUpdateTrigger"
      @interaction="handleNodeInteraction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'

import { useNodeInteractionProxy } from '@/composables/nodeRendering/useNodeInteractionProxy'
import { api } from '@/scripts/api'
import { isComponentWidget, isDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/stores/graphStore'

import VueNode from './VueNode.vue'

const { handleNodeInteraction } = useNodeInteractionProxy()
const canvasStore = useCanvasStore()
const executionStore = useExecutionStore()

// Reactive trigger for graph changes
const graphUpdateTrigger = ref(0)

// Force update phantom nodes when graph changes
const forceUpdate = () => {
  graphUpdateTrigger.value++
}

// Get phantom nodes directly from canvas with reactive trigger
const phantomNodes = computed(() => {
  // Access reactive trigger to ensure computed re-runs on graph changes
  graphUpdateTrigger.value

  if (!canvasStore.canvas?.graph) {
    return []
  }

  const allNodes = canvasStore.canvas.graph._nodes
  const phantomNodes = allNodes.filter(
    (node: any) => node.phantom_mode === true
  )

  // Register widgets for phantom nodes if not already registered
  const domWidgetStore = useDomWidgetStore()
  phantomNodes.forEach((node: any) => {
    if (node.widgets) {
      node.widgets.forEach((widget: any) => {
        // Check if it's a DOM widget that needs registration
        if (
          (isDOMWidget(widget) || isComponentWidget(widget)) &&
          widget.id &&
          !domWidgetStore.widgetStates.has(widget.id)
        ) {
          domWidgetStore.registerWidget(widget)
        }
      })
    }
  })

  return phantomNodes
})

// Simple animation frame updates - always running for smooth dragging
let rafId: number | null = null

const startFrameUpdates = () => {
  const updateEveryFrame = () => {
    forceUpdate()
    rafId = requestAnimationFrame(updateEveryFrame)
  }
  updateEveryFrame()
}

const stopFrameUpdates = () => {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

// Listen for graph changes
onMounted(() => {
  // Listen to API events for graph changes (now includes ds changes)
  api.addEventListener('graphChanged', forceUpdate)

  // Start continuous frame updates for smooth dragging
  startFrameUpdates()

  // Initial update
  forceUpdate()
})

onUnmounted(() => {
  api.removeEventListener('graphChanged', forceUpdate)
  stopFrameUpdates()
})

// Get canvas transform directly from canvas
const canvasScale = computed(() => {
  return canvasStore.canvas?.ds?.scale || 1
})

const canvasOffset = computed(() => {
  const canvas = canvasStore.canvas
  return {
    x: canvas?.ds?.offset?.[0] || 0,
    y: canvas?.ds?.offset?.[1] || 0
  }
})

// Check if node is selected
const isNodeSelected = (nodeId: string) => {
  return canvasStore.selectedItems.some(
    (item: any) => item.id === Number(nodeId)
  )
}

// Check if node is executing
const isNodeExecuting = (nodeId: string) => {
  return executionStore.executingNodeId === Number(nodeId)
}

</script>

<style scoped>
.vue-node-overlay {
  /* Ensure overlay doesn't interfere with canvas interactions */
  z-index: 1;
}
</style>
