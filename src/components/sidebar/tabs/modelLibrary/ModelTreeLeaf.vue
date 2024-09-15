<template>
  <div ref="container" class="model-lib-node-container">
    <TreeExplorerTreeNode :node="node"> </TreeExplorerTreeNode>
  </div>
</template>

<script setup lang="ts">
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { ComfyModelDef } from '@/stores/modelStore'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyModelDef>
}>()
</script>

<style scoped>
.model-lib-node-container {
  @apply h-full w-full;
}
</style>
