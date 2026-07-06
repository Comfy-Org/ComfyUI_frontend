<template>
  <div class="px-3">
    <SwapNodeGroupRow
      v-for="group in swapNodeGroups"
      :key="group.type"
      :group="group"
      :highlighted="isGroupHighlighted(group)"
      @locate-node="emit('locate-node', $event)"
      @replace="emit('replace', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import SwapNodeGroupRow from '@/platform/nodeReplacement/components/SwapNodeGroupRow.vue'

const { swapNodeGroups, highlightedNodeIds } = defineProps<{
  swapNodeGroups: SwapNodeGroup[]
  /** Execution node ids to emphasize (current canvas selection). */
  highlightedNodeIds?: Set<string>
}>()

function isGroupHighlighted(group: SwapNodeGroup) {
  if (!highlightedNodeIds?.size) return false
  return group.nodeTypes.some(
    (nodeType) =>
      typeof nodeType !== 'string' &&
      nodeType.nodeId != null &&
      highlightedNodeIds.has(String(nodeType.nodeId))
  )
}

const emit = defineEmits<{
  'locate-node': [nodeId: string]
  replace: [group: SwapNodeGroup]
}>()
</script>
