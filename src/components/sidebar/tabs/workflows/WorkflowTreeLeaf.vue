<template>
  <TreeExplorerTreeNode :node="node">
    <template #actions="{ node }">
      <Button
        :icon="isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
        text
        severity="secondary"
        size="small"
        @click.stop="workflowBookmarkStore.toggleBookmarked(node.data.path)"
      />
    </template>
  </TreeExplorerTreeNode>
</template>

<script setup lang="ts">
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import Button from 'primevue/button'
import { ComfyWorkflow, useWorkflowBookmarkStore } from '@/stores/workflowStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { computed } from 'vue'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyWorkflow>
}>()

const workflowBookmarkStore = useWorkflowBookmarkStore()
const isBookmarked = computed(() =>
  workflowBookmarkStore.isBookmarked(props.node.data.path)
)
</script>
