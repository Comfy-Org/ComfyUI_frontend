<template>
  <Tree
    v-model:expandedKeys="expandedKeys"
    :value="renderedRoot.children"
    :filter="true"
    filterMode="lenient"
  ></Tree>
</template>

<script setup lang="ts">
import Tree from 'primevue/tree'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { computed, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'

const expandedKeys = ref({})
const root = computed(() => useNodeDefStore().nodeTree)
const renderedRoot = computed(() => {
  return fillNodeInfo(root.value)
})
const fillNodeInfo = (node: TreeNode) => {
  const isLeaf = node.children === undefined || node.children.length === 0
  const isExpanded = expandedKeys.value[node.key]
  const icon = isLeaf
    ? 'pi pi-file'
    : isExpanded
      ? 'pi pi-folder-open'
      : 'pi pi-folder'

  return {
    ...node,
    icon,
    children: node.children?.map(fillNodeInfo)
  }
}
</script>
