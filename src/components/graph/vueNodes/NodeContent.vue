<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Content Error
  </div>
  <div v-else class="lg-node-content">
    <!-- Default slot for custom content -->
    <slot>
      <!-- This component serves as a placeholder for future extensibility -->
      <!-- Currently all node content is rendered through the widget system -->
    </slot>
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'

interface NodeContentProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
}

defineProps<NodeContentProps>()

// Error boundary implementation
const renderError = ref<string | null>(null)

onErrorCaptured((error) => {
  renderError.value = error.message
  console.error('Vue node content error:', error)
  return false
})
</script>
