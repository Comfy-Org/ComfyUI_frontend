<template>
  <SideBarTabTemplate :title="$t('sideToolBar.workflows')">
    <template #tool-buttons>
      <Button
        icon="pi pi-refresh"
        @click="async () => await userFileStore.loadFiles()"
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
import { useUserFileStore } from '@/stores/userFileStore'
import TreePlus from '@/components/primevueOverride/TreePlus.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { TreeNode } from 'primevue/treenode'
import _ from 'lodash'
import EditableText from './EditableText.vue'
import { useToast } from 'primevue/usetoast'
import { downloadBlob } from '@/scripts/utils'
import { app } from '@/scripts/app'
import { findNodeByKey } from '@/utils/treeUtil'

const toast = useToast()

// Whether the node is in editing mode for label edit.
const editingNode = ref<TreeNode | null>(null)
const renameNode = async (node: TreeNode, newName: string) => {
  if (newName !== node.label) {
    const oldPath = node.key
    const newPath = oldPath.slice(0, oldPath.lastIndexOf('/') + 1) + newName
    const result = await userFileStore.renameFile(oldPath, newPath)
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
  const result = await userFileStore.deleteFile(node.key)
  if (!result.success) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to delete file\n${result.message}`
    })
  }
}

const downloadWorkflow = async (node: TreeNode) => {
  const result = await userFileStore.getFileData(node.key)
  if (!result.success) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to download file\n${result.message}`
    })
  } else {
    const blob = new Blob([JSON.stringify(result.data)], {
      type: 'application/json'
    })
    downloadBlob(node.label, blob)
  }
}

const generateWorkflowPath = (folder: string) => {
  const prefix = 'new_workflow'
  let index = 1
  let name = `${prefix}.json`
  while (findNodeByKey(renderedRoot.value, folder + name)) {
    name = `${prefix}_${index++}.json`
  }
  return folder + name
}

const loadWorkflow = async (node: TreeNode) => {
  if (!node.leaf) {
    return
  }
  const result = await userFileStore.getFileData(node.key)
  if (!result.success) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to load file\n${result.message}`
    })
  } else {
    app.loadGraphData(result.data)
    app.resetView()
  }
}

const createDefaultWorkflow = async (node: TreeNode) => {
  const folder = node.leaf
    ? node.key.slice(0, node.key.lastIndexOf('/') + 1)
    : node.key + '/'

  const path = generateWorkflowPath(folder)
  const result = await userFileStore.createDefaultWorkflow(path)
  if (!result.success) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to create new workflow\n${result.message}`
    })
  } else {
    const newNode = findNodeByKey(renderedRoot.value, path)
    editingNode.value = newNode
    await loadWorkflow(newNode)
  }
}

const menu = ref(null)
const menuTargetNode = ref<TreeNode | null>(null)
const menuItems = computed<MenuItem[]>(() => {
  if (!menuTargetNode.value) {
    return []
  }

  const isRoot = menuTargetNode.value.key === renderedRoot.value.key

  return [
    {
      label: 'New Workflow',
      icon: 'pi pi-plus',
      command: () => createDefaultWorkflow(menuTargetNode.value)
    },
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
      command: () => downloadWorkflow(menuTargetNode.value),
      visible: menuTargetNode.value.leaf
    }
  ]
})

const selectedKeys = ref(null)
watch(selectedKeys, async (newVal) => {
  if (newVal) {
    const key = Object.keys(newVal)[0]
    const node = findNodeByKey(renderedRoot.value, key)
    await loadWorkflow(node)
  }
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
const userFileStore = useUserFileStore()
const root = computed<TreeNode>(() => userFileStore.workflowsTree)
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
  await userFileStore.loadFiles()
})
</script>
