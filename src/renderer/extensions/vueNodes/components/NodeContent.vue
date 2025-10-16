<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-red-500">
    {{ $t('Node Content Error') }}
  </div>
  <div v-else class="lg-node-content flex h-full flex-col">
    <!-- Default slot for custom content -->
    <slot>
      <VideoPreview
        v-if="hasMedia && media?.type === 'video'"
        :image-urls="media.urls"
        :node-id="nodeId"
        class="mt-2"
      />
      <ImagePreview
        v-else-if="hasMedia && media?.type === 'image'"
        :image-urls="media.urls"
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

import VideoPreview from '../VideoPreview.vue'
import ImagePreview from './ImagePreview.vue'

interface NodeContentProps {
  nodeData?: VueNodeData
  media?: {
    type: 'image' | 'video'
    urls: string[]
  }
}

const props = defineProps<NodeContentProps>()

const hasMedia = computed(() => props.media && props.media.urls.length > 0)

// Get node ID from nodeData
const nodeId = computed(() => props.nodeData?.id?.toString())

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
