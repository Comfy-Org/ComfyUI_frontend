<template>
  <div v-if="nodeInfo" class="rounded-lg bg-interface-surface p-3">
    <NodeHelpContent :node="nodeInfo" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import NodeHelpContent from '@/components/node/NodeHelpContent.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

const props = defineProps<{
  nodes: LGraphNode[]
}>()
const node = computed(() => props.nodes[0])

const nodeDefStore = useNodeDefStore()
const nodeHelpStore = useNodeHelpStore()

const nodeInfo = computed(() => {
  return nodeDefStore.fromLGraphNode(node.value)
})

// Open node help when the selected node changes
watch(
  nodeInfo,
  (info) => {
    if (info) {
      nodeHelpStore.openHelp(info)
    }
  },
  { immediate: true }
)
</script>
