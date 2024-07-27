<template>
  <TreePlus
    v-model:expandedKeys="expandedKeys"
    v-model:selectionKeys="selectedKeys"
    selectionMode="single"
    :value="renderedRoot.children"
    :filter="true"
    filterMode="lenient"
    dragSelector=".p-tree-node-leaf"
    :pt="{
      nodeLabel: 'node-lib-tree-node-label',
      nodeChildren: ({ props }) => ({
        'data-comfy-node-name': props.node?.data?.name
      })
    }"
  >
    <template #folder="{ node }">
      <span class="folder-label">{{ node.label }}</span>
      <Badge :value="node.totalNodes" severity="secondary"></Badge>
    </template>
    <template #node="{ node }">
      <span class="node-label">{{ node.label }}</span>
    </template>
  </TreePlus>
  <teleport to=".graph-canvas-panel">
    <div v-if="selectedNode" class="node-lib-node-preview">
      <NodePreview
        :key="selectedNode.name"
        :nodeDef="selectedNode"
      ></NodePreview>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { computed, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import NodePreview from '@/components/NodePreview.vue'

const nodeDefStore = useNodeDefStore()
const expandedKeys = ref({})
const selectedKeys = ref(null)
const selectedNode = computed<ComfyNodeDefImpl | null>(() => {
  if (!selectedKeys.value || Object.keys(selectedKeys.value).length === 0) {
    return null
  }
  const key = Object.keys(selectedKeys.value)[0]
  const nodeName = key.split('/')[key.split('/').length - 1]
  return nodeDefStore.nodeDefsByName[nodeName] || null
})

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

<style>
.node-lib-node-preview {
  position: absolute;
  top: 50px;
  left: 50px;
}
</style>
