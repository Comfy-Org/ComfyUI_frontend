<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    {{ $t('Node Content Error') }}
  </div>
  <div v-else class="lg-node-content">
    <!-- Default slot for custom content -->
    <slot>
      <VideoPreview
        v-if="hasMediaUrls && isVideo"
        :image-urls="props.mediaUrls || []"
        :node-id="nodeId"
        class="mt-2"
      />
      <ImagePreview
        v-else-if="hasMediaUrls"
        :image-urls="props.mediaUrls || []"
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
import { isVideoNode } from '@/utils/litegraphUtil'

import VideoPreview from '../VideoPreview.vue'
import ImagePreview from './ImagePreview.vue'

interface NodeContentProps {
  node?: LGraphNode | null
  nodeData?: VueNodeData
  mediaUrls?: string[] // URLs for images, videos, or other media
}

const props = defineProps<NodeContentProps>()

const hasMediaUrls = computed(
  () => props.mediaUrls && props.mediaUrls.length > 0
)

const isVideo = computed(() => {
  return props.node ? isVideoNode(props.node) : false
})

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
