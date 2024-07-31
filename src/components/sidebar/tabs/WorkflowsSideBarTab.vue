<template>
  <SideBarTabTemplate :title="$t('sideToolBar.workflows')">
    <template #tool-buttons>
      <Button
        icon="pi pi-refresh"
        @click="workflowStore.loadFiles"
        text
        severity="secondary"
      />
    </template>
    <template #body>
      <TreePlus
        :value="renderedRoot.children"
        v-model:expandedKeys="expandedKeys"
        :filter="true"
        filterMode="lenient"
        dragSelector=".p-tree-node-leaf"
      >
      </TreePlus>
    </template>
  </SideBarTabTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import SideBarTabTemplate from './SideBarTabTemplate.vue'
import { useWorkflowStore } from '@/stores/workflowStore'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import { computed, onMounted, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'
import _ from 'lodash'

const isImageFile = (fileName: string): boolean => {
  const imageExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.bmp',
    '.svg',
    '.webp'
  ]
  return _.some(imageExtensions, (extension) =>
    fileName.toLowerCase().endsWith(extension)
  )
}

const getFileIcon = (fileName: string) => {
  if (fileName.endsWith('.json')) {
    return 'pi pi-code'
  } else if (isImageFile(fileName)) {
    return 'pi pi-image'
  } else {
    return 'pi pi-file'
  }
}

const expandedKeys = ref({})
const workflowStore = useWorkflowStore()
const root = computed<TreeNode>(() => workflowStore.fileTree)
const renderedRoot = computed(() => {
  return fillNodeInfo(root.value)
})
const fillNodeInfo = (node: TreeNode): TreeNode => {
  const isLeaf = node.children === undefined || node.children.length === 0
  const isExpanded = expandedKeys.value[node.key]
  const icon = isLeaf
    ? getFileIcon(node.label)
    : isExpanded
      ? 'pi pi-folder-open'
      : 'pi pi-folder'
  const children = node.children?.map(fillNodeInfo)

  return {
    ...node,
    icon,
    children,
    totalNodes: isLeaf
      ? 1
      : children.reduce((acc, child) => acc + child.totalNodes, 0)
  }
}
onMounted(async () => {
  await workflowStore.loadFiles()
})
</script>
