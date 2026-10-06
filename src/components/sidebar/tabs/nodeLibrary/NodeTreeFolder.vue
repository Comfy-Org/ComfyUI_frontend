<template>
  <div
    class="node-lib-node-container"
    data-testid="node-tree-folder"
    :data-folder-name="node.label"
  >
    <TreeExplorerTreeNode :node="node" @item-dropped="handleItemDrop" />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { InjectKeyExpandedKeys } from '@/types/treeExplorerTypes'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

const expandedKeys = inject(InjectKeyExpandedKeys)
const handleItemDrop = (node: RenderedTreeExplorerNode<ComfyNodeDefImpl>) => {
  if (!expandedKeys) return
  expandedKeys.value[node.key] = true
}
</script>
