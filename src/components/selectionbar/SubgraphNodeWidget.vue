<template>
  <div ref="container" class="node-lib-node-container">
    <TreeExplorerTreeNode :node="node">
      <template #actions>
        <Button
          size="small"
          :icon="'pi pi-bookmark-fill'"
          text
          severity="secondary"
          @click.stop="onClick"
        />
      </template>
    </TreeExplorerTreeNode>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
}>()

function onClick(e) {
}
</script>

<style scoped>
.node-lib-node-container {
  @apply h-full w-full;
}
</style>
