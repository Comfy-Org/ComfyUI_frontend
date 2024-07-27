<template>
  <Tree
    v-model:expandedKeys="expandedKeys"
    v-model:selectionKeys="selectedKeys"
    selectionMode="single"
    :value="renderedRoot.children"
    :filter="true"
    filterMode="lenient"
    :pt="{
      nodeLabel: 'node-lib-tree-node-label'
    }"
  >
    <template #folder="{ node }">
      <span class="folder-label">{{ node.label }}</span>
      <Badge :value="node.totalNodes" severity="secondary"></Badge>
    </template>
    <template #node="{ node }">
      <span class="node-label" @click="showNodePreview">{{ node.label }}</span>
    </template>
  </Tree>
  <PopoverPlus ref="op">
    <div v-if="selectedNode">
      <NodePreview :nodeDef="selectedNode"></NodePreview>
    </div>
  </PopoverPlus>
</template>

<script setup lang="ts">
import Tree from 'primevue/tree'
import Badge from 'primevue/badge'
import PopoverPlus from '@/components/primevueOverride/PopoverPlus.vue'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { computed, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'
import NodePreview from '@/components/NodePreview.vue'

const nodeDefStore = useNodeDefStore()
const expandedKeys = ref({})
const selectedKeys = ref(null)
const selectedNode = computed<ComfyNodeDefImpl | null>(() => {
  if (!selectedKeys.value) {
    return null
  }
  const key = Object.keys(selectedKeys.value)[0]
  const nodeName = key.split('/')[key.split('/').length - 1]
  return nodeDefStore.nodeDefsByName[nodeName] || null
})
const op = ref(null)
const showNodePreview = (e) => {
  op.value.show(e)
}

const root = computed(() => nodeDefStore.nodeTree)
const renderedRoot = computed(() => {
  return fillNodeInfo(root.value)
})
const fillNodeInfo = (node: TreeNode): TreeNode => {
  const isLeaf = node.children === undefined || node.children.length === 0
  const isExpanded = expandedKeys.value[node.key]
  const icon = isLeaf
    ? 'pi pi-circle'
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
