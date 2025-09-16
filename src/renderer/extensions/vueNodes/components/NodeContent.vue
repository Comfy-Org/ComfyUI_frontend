<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Content Error') }}
  </div>
  <div v-else class="lg-node-content">
    <!-- Default slot for custom content -->
    <slot>
      <ImagePreview
        v-if="hasImages"
        :image-urls="props.imageUrls || []"
        :node-id="nodeId"
        class="mt-2"
      />
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'

import ImagePreview from './ImagePreview.vue'

interface NodeContentProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
  lodLevel?: LODLevel
  imageUrls?: string[]
}

const props = defineProps<NodeContentProps>()

const hasImages = computed(() => props.imageUrls && props.imageUrls.length > 0)

// Get node ID from nodeData or node prop
const nodeId = computed(() => {
  return props.nodeData?.id?.toString() || props.node?.id?.toString()
})

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
