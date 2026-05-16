<template>
  <NodePreviewCard
    v-if="nodeDef"
    :node-def="nodeDef"
    :show-inputs-and-outputs="false"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import type { EssentialPlaceholderTile } from '@/constants/essentialsPlaceholders'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const { tile } = defineProps<{
  tile: EssentialPlaceholderTile
}>()

const nodeDefStore = useNodeDefStore()
const nodeDef = computed(() => {
  if (tile.nodeName) {
    const match = nodeDefStore.nodeDefsByName[tile.nodeName]
    if (match) return match
  }
  return nodeDefStore.visibleNodeDefs[0]
})
</script>
