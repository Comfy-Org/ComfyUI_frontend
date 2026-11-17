<template>
  <div class="flex min-h-0 flex-1 flex-col gap-1">
    <div
      v-for="part in parts"
      :key="part.kind === 'live' ? `live:${part.source}` : `media:${part.type}`"
      class="flex min-h-0 flex-1 flex-col"
    >
      <LivePreview
        v-if="part.kind === 'live'"
        :image-url="part.url"
        :fits-container
      />
      <NodeContent v-else :node-data :media="part" :fits-container />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { NodePreviewPart } from '@/systems/nodePreviewSystem'

import LivePreview from './LivePreview.vue'
import NodeContent from './NodeContent.vue'

const { fitsContainer = false } = defineProps<{
  parts: readonly NodePreviewPart[]
  nodeData?: NodeState
  fitsContainer?: boolean
}>()
</script>
