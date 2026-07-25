<script setup lang="ts">
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import AgentNodeChip from './AgentNodeChip.vue'

const { nodes } = defineProps<{
  nodes: readonly LGraphNode[]
}>()
</script>

<template>
  <div v-if="nodes.length" class="flex flex-wrap justify-end gap-1.5">
    <AgentNodeChip v-for="node in nodes" :key="node.id" :node="node" />
  </div>
</template>
