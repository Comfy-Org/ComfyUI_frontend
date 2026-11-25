<template>
  <div v-if="renderError" class="node-error p-2 text-sm text-destructive">
    {{ st('nodeErrors.content', 'Node Content Error') }}
  </div>
  <VideoPreview
    v-else-if="hasMedia && media?.type === 'video'"
    :image-urls="media.items.map((item) => resultItemPreviewUrl(item))"
    :node-id="nodeId"
    class="lg-node-content mt-2 min-h-0 flex-1"
  />
  <AudioPreview
    v-else-if="hasMedia && media?.type === 'audio'"
    :audio-urls="media.items.map((item) => resultItemPreviewUrl(item))"
    class="lg-node-content mt-2 min-h-0 flex-1"
  />
  <ImagePreview
    v-else-if="hasMedia && media?.type === 'image'"
    :items="media.items"
    :node-id="nodeId"
    :full-resolution="nodeData?.flags.fullResolutionPreview"
    class="lg-node-content min-h-0 flex-1"
    :style="{ marginTop: `${IMAGE_PREVIEW_MARGIN_TOP}px` }"
  />
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemPreviewUrl } from '@/utils/resultItemUrl'

import AudioPreview from '@comfyorg/design-system/media/AudioPreview'
import VideoPreview from '@/renderer/extensions/vueNodes/VideoPreview.vue'
import ImagePreview from './ImagePreview.vue'
import { IMAGE_PREVIEW_MARGIN_TOP } from './imagePreviewLayout'

interface NodeContentProps {
  nodeData?: NodeState
  media?: { type: 'video' | 'image' | 'audio'; items: AugmentedResultItem[] }
}

const props = defineProps<NodeContentProps>()

const hasMedia = computed(() => props.media && props.media.items.length > 0)

const nodeId = computed(() => props.nodeData?.id)

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})
</script>
