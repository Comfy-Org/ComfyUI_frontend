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

const BLUEPRINT_PREFIX = 'SubgraphBlueprint.'

const nodeDefStore = useNodeDefStore()
const nodeDef = computed(() => {
  if (!tile.nodeName) return undefined
  const byName = nodeDefStore.allNodeDefsByName[tile.nodeName]
  if (byName) return byName
  const target = tile.nodeName.startsWith(BLUEPRINT_PREFIX)
    ? tile.nodeName.slice(BLUEPRINT_PREFIX.length)
    : tile.nodeName
  return nodeDefStore.nodeDefs.find((d) => d.display_name === target)
})
</script>
