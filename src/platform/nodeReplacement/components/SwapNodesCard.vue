<template>
  <div class="px-3">
    <SwapNodeGroupRow
      v-for="group in swapNodeGroups"
      :key="group.type"
      :group="group"
      :highlighted="
        someNodeTypeInSelection(group.nodeTypes, highlightedNodeIds)
      "
      @locate-node="emit('locate-node', $event)"
      @replace="emit('replace', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { someNodeTypeInSelection } from '@/components/rightSidePanel/errors/selectionEmphasis'
import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import SwapNodeGroupRow from '@/platform/nodeReplacement/components/SwapNodeGroupRow.vue'

const { swapNodeGroups } = defineProps<{
  swapNodeGroups: SwapNodeGroup[]
  /** Execution node ids to emphasize (current canvas selection). */
  highlightedNodeIds?: Set<string>
}>()

const emit = defineEmits<{
  'locate-node': [nodeId: string]
  replace: [group: SwapNodeGroup]
}>()
</script>
