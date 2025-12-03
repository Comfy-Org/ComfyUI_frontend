<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed } from 'vue'

import NodeHelpContent from '@/components/node/NodeHelpContent.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()
const node = computed(() => nodes[0])

const nodeDefStore = useNodeDefStore()
const nodeHelpStore = useNodeHelpStore()

const nodeInfo = computed(() => {
  return nodeDefStore.fromLGraphNode(node.value)
})

// Open node help when the selected node changes
whenever(
  nodeInfo,
  (info) => {
    nodeHelpStore.openHelp(info)
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="nodeInfo" class="p-3">
    <NodeHelpContent :node="nodeInfo" />
  </div>
</template>
