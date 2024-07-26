<template>
  <Tree
    v-model:expandedKeys="expandedKeys"
    :value="renderedRoot.children"
    :filter="true"
    filterMode="lenient"
  >
    <template #folder="{ node }">
      <span class="folder-label">{{ node.label }}</span>
      <Badge :value="node.totalNodes" severity="secondary"></Badge>
    </template>
    <template #node="{ node }">
      <span class="node-label">{{ node.label }}</span>
    </template>
  </Tree>
</template>

<script setup lang="ts">
import Tree from 'primevue/tree'
import Badge from 'primevue/badge'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { computed, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'

const expandedKeys = ref({})
const root = computed(() => useNodeDefStore().nodeTree)
const renderedRoot = computed(() => {
  return fillNodeInfo(root.value)
})
const fillNodeInfo = (node: TreeNode): TreeNode => {
  const isLeaf = node.children === undefined || node.children.length === 0
  const isExpanded = expandedKeys.value[node.key]
  const icon = isLeaf
    ? 'pi pi-file'
    : isExpanded
      ? 'pi pi-folder-open'
      : 'pi pi-folder'
  const children = node.children?.map(fillNodeInfo)

  return {
    ...node,
    icon,
    children,
    type: isLeaf ? 'node' : 'folder',
    totalNodes: isLeaf
      ? 1
      : children.reduce((acc, child) => acc + child.totalNodes, 0)
  }
}
</script>
