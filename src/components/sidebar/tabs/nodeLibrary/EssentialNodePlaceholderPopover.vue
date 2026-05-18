<template>
  <NodePreviewCard
    v-if="nodeDef"
    :node-def="nodeDef"
    :show-inputs-and-outputs="false"
  />
</template>

<script setup lang="ts">
import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useEssentialTileNodeDef } from '@/composables/useEssentialTileNodeDef'
import type { EssentialPlaceholderTile } from '@/constants/essentialsPlaceholders'

const { tile } = defineProps<{
  tile: EssentialPlaceholderTile
}>()

const nodeDef = useEssentialTileNodeDef(() => tile)
</script>
