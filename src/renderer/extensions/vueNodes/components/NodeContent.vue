<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Content Error') }}
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
import { onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'

interface NodeContentProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
  lodLevel?: LODLevel
}

defineProps<NodeContentProps>()

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
