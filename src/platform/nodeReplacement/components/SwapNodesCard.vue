<template>
  <div class="px-3">
    <SwapNodeGroupRow
      v-for="group in swapNodeGroups"
      :key="group.type"
      :group="group"
      @locate-node="emit('locate-node', $event)"
      @replace="emit('replace', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SwapNodeGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import SwapNodeGroupRow from '@/platform/nodeReplacement/components/SwapNodeGroupRow.vue'

const { swapNodeGroups } = defineProps<{
  swapNodeGroups: SwapNodeGroup[]
}>()

const emit = defineEmits<{
  'locate-node': [nodeId: string]
  replace: [group: SwapNodeGroup]
}>()
</script>
