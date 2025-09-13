<template>
  <TreeExplorerTreeNode :node="node">
    <template #actions>
      <Button
        :icon="isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
        text
        severity="secondary"
        size="small"
        @click.stop="handleBookmarkClick"
      />
    </template>
  </TreeExplorerTreeNode>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { ComfyWorkflow, useWorkflowBookmarkStore } from '@/stores/workflowStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<ComfyWorkflow>
}>()

const workflowBookmarkStore = useWorkflowBookmarkStore()
const isBookmarked = computed(
  () => node.data && workflowBookmarkStore.isBookmarked(node.data.path)
)

const handleBookmarkClick = async () => {
  if (node.data) {
    await workflowBookmarkStore.toggleBookmarked(node.data.path)
  }
}
</script>
