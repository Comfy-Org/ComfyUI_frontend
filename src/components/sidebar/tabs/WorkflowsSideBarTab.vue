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
        :value="[renderedRoot]"
        v-model:expandedKeys="expandedKeys"
        :filter="true"
        filterMode="lenient"
        dragSelector=".p-tree-node-leaf"
        :pt="{
          nodeChildren: ({ props }) => ({
            onContextmenu: (event: MouseEvent) => {
              menu.show(event)
            }
          })
        }"
      >
        <template #file="{ node }">
          <EditableText
            :modelValue="node.label"
            @edit="workflowStore.renameFile(node.label, $event)"
          />
        </template>
      </TreePlus>
      <ContextMenu ref="menu" :model="menuItems" />
    </template>
  </SideBarTabTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import SideBarTabTemplate from './SideBarTabTemplate.vue'
import { useWorkflowStore } from '@/stores/workflowStore'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import { computed, onMounted, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'
import _ from 'lodash'
import EditableText from './EditableText.vue'

const menu = ref(null)
const menuItems = ref([
  {
    label: 'Rename',
    icon: 'pi pi-file-edit',
    command: () => console.log('rename file!')
  },
  { label: 'Delete', icon: 'pi pi-trash' },
  { label: 'Export', icon: 'pi pi-file-export' }
])

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
  const isExpanded = expandedKeys.value[node.key]
  const icon = node.leaf
    ? getFileIcon(node.label)
    : isExpanded
      ? 'pi pi-folder-open'
      : 'pi pi-folder'
  const children = node.children?.map(fillNodeInfo)

  return {
    ...node,
    icon,
    children,
    type: node.leaf ? 'file' : 'folder',
    totalNodes: node.children
      ? children.reduce((acc, child) => acc + child.totalNodes, 0)
      : 1
  }
}
onMounted(async () => {
  await workflowStore.loadFiles()
})
</script>
