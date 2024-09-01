<template>
  <TreeExplorer :roots="props.roots">
    <template #node="{ node }">
      <NodeTreeLeaf :node="node" />
    </template>
  </TreeExplorer>
</template>

<script setup lang="ts">
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import NodeTreeLeaf from '@/components/sidebar/tabs/nodeLibrary/NodeTreeLeaf.vue'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  roots: TreeExplorerNode<ComfyNodeDefImpl>[]
}>()
</script>
