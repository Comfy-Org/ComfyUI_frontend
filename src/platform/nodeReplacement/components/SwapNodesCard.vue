<template>
  <div class="px-3">
    <SwapNodeGroupRow
      v-for="group in swapNodeGroups"
      :key="group.type"
      :group="group"
      :class="
        cn(
          isGroupHighlighted(group) &&
            'rounded-md ring-1 ring-primary-background/60'
        )
      "
      @locate-node="emit('locate-node', $event)"
      @replace="emit('replace', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

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
