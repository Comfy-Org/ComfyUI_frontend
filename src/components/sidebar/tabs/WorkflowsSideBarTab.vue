<template>
  <SideBarTabTemplate :title="$t('sideToolBar.workflows')">
    <template #tool-buttons>
      <Button
        icon="pi pi-refresh"
        @click="async () => await workflowStore.loadFiles()"
        text
        severity="secondary"
      />
    </template>
    <template #body>
      <TreePlus
        :value="[renderedRoot]"
        v-model:expandedKeys="expandedKeys"
        v-model:selectionKeys="selectedKeys"
        selectionMode="single"
        :filter="true"
        filterMode="lenient"
        dragSelector=".p-tree-node-leaf"
        :pt="{
          nodeContent: ({ props }) => ({
            onContextmenu: (event: MouseEvent) => {
              menuTargetNode = props.node
              menu.show(event)
            }
          })
        }"
      >
        <template #default="{ node }">
          <EditableText
            :modelValue="node.label"
            :isEditing="node.key === editingNode?.key"
            @edit="renameNode(node, $event)"
          />
        </template>
      </TreePlus>
      <ContextMenu
        ref="menu"
        :model="menuItems"
        @hide="menuTargetNode = null"
      />
    </template>
  </SideBarTabTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import SideBarTabTemplate from './SideBarTabTemplate.vue'
import { MenuItem } from 'primevue/menuitem'
import { useWorkflowStore } from '@/stores/workflowStore'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import { computed, onMounted, ref } from 'vue'
import { TreeNode } from 'primevue/treenode'
import _ from 'lodash'
import EditableText from './EditableText.vue'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

// Whether the node is in editing mode for label edit.
const editingNode = ref<TreeNode | null>(null)
const renameNode = async (node: TreeNode, newName: string) => {
  if (newName !== node.label) {
    const oldPath = node.key
    const newPath = oldPath.slice(0, oldPath.lastIndexOf('/') + 1) + newName
    const result = await workflowStore.renameFile(oldPath, newPath)
    if (!result.success) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: `Failed to rename file\n${result.message}`
      })
    }
  }
  editingNode.value = null
}
const deleteNode = async (node: TreeNode) => {
  const result = await workflowStore.deleteFile(node.key)
  if (!result.success) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to delete file\n${result.message}`
    })
  }
}
const menu = ref(null)
const menuTargetNode = ref<TreeNode | null>(null)
const menuItems = computed<MenuItem[]>(() => {
  if (!menuTargetNode.value) {
    console.error("Menu target node doesn't exist. This should never happen.")
    return []
  }

  const isRoot = menuTargetNode.value.key === renderedRoot.value.key

  return [
    {
      label: 'Rename',
      icon: 'pi pi-file-edit',
      command: () => (editingNode.value = menuTargetNode.value),
      disabled: isRoot
    },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => deleteNode(menuTargetNode.value),
      disabled: isRoot
    },
    {
      label: 'Download',
      icon: 'pi pi-download',
      visible: menuTargetNode.value.leaf
    }
  ]
})

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
const selectedKeys = ref(null)
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
