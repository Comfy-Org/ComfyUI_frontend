<template>
  <div 
    class="vue-node-overlay absolute inset-0 pointer-events-none overflow-hidden"
    :style="overlayStyle"
  >
    <VueNode
      v-for="node in visibleNodes"
      :key="node.id"
      :node="node"
      :position="nodePositions[node.id]"
      :selected="isNodeSelected(node.id)"
      :executing="isNodeExecuting(node.id)"
      @interaction="handleNodeInteraction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNodePositionSync } from '@/composables/nodeRendering/useNodePositionSync'
import { useNodeInteractionProxy } from '@/composables/nodeRendering/useNodeInteractionProxy'
import { useCanvasStore } from '@/stores/graphStore'
import { useExecutionStore } from '@/stores/executionStore'
import VueNode from './VueNode.vue'

const { 
  nodePositions, 
  canvasScale, 
  canvasOffset, 
  visibleNodes 
} = useNodePositionSync()

const { handleNodeInteraction } = useNodeInteractionProxy()

const canvasStore = useCanvasStore()
const executionStore = useExecutionStore()

// Transform style for the overlay to match canvas transform
const overlayStyle = computed(() => ({
  transform: `scale(${canvasScale.value}) translate(${canvasOffset.value.x}px, ${canvasOffset.value.y}px)`,
  transformOrigin: '0 0'
}))

// Check if node is selected
const isNodeSelected = (nodeId: string) => {
  return canvasStore.selectedItems.has(Number(nodeId))
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