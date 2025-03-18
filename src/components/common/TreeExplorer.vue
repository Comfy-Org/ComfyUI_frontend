<template>
  <Tree
    class="tree-explorer py-0 px-2 2xl:px-4"
    :class="props.class"
    v-model:expandedKeys="expandedKeys"
    v-model:selectionKeys="selectionKeys"
    :value="renderedRoot.children"
    selectionMode="single"
    :pt="{
      nodeLabel: 'tree-explorer-node-label',
      nodeContent: ({ context }) => ({
        class: 'group/tree-node',
        onClick: (e: MouseEvent) =>
          onNodeContentClick(e, context.node as RenderedTreeExplorerNode),
        onContextmenu: (e: MouseEvent) =>
          handleContextMenu(e, context.node as RenderedTreeExplorerNode)
      }),
      nodeToggleButton: () => ({
        onClick: (e: MouseEvent) => {
          e.stopImmediatePropagation()
        }
      })
    }"
  >
    <template #folder="{ node }">
      <slot name="folder" :node="node">
        <TreeExplorerTreeNode :node="node" />
      </slot>
    </template>
    <template #node="{ node }">
      <slot name="node" :node="node">
        <TreeExplorerTreeNode :node="node" />
      </slot>
    </template>
  </Tree>
  <ContextMenu ref="menu" :model="menuItems" />
</template>
<script setup lang="ts">
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import Tree from 'primevue/tree'
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { useTreeFolderOperations } from '@/composables/tree/useTreeFolderOperations'
import { useErrorHandling } from '@/composables/useErrorHandling'
import {
  InjectKeyExpandedKeys,
  InjectKeyHandleEditLabelFunction,
  type RenderedTreeExplorerNode,
  type TreeExplorerNode
} from '@/types/treeExplorerTypes'
import { combineTrees, findNodeByKey } from '@/utils/treeUtil'

const expandedKeys = defineModel<Record<string, boolean>>('expandedKeys', {
  required: true
})
provide(InjectKeyExpandedKeys, expandedKeys)
const selectionKeys = defineModel<Record<string, boolean>>('selectionKeys')
// Tracks whether the caller has set the selectionKeys model.
const storeSelectionKeys = selectionKeys.value !== undefined

const props = defineProps<{
  root: TreeExplorerNode
  class?: string
}>()
const emit = defineEmits<{
  (e: 'nodeClick', node: RenderedTreeExplorerNode, event: MouseEvent): void
  (e: 'nodeDelete', node: RenderedTreeExplorerNode): void
  (e: 'contextMenu', node: RenderedTreeExplorerNode, event: MouseEvent): void
}>()

const {
  newFolderNode,
  getAddFolderMenuItem,
  handleFolderCreation,
  addFolderCommand
} = useTreeFolderOperations(
  /* expandNode */ (node: TreeExplorerNode) => {
    expandedKeys.value[node.key] = true
  }
)

const renderedRoot = computed<RenderedTreeExplorerNode>(() => {
  const renderedRoot = fillNodeInfo(props.root)
  return newFolderNode.value
    ? combineTrees(renderedRoot, newFolderNode.value)
    : renderedRoot
})
const getTreeNodeIcon = (node: TreeExplorerNode) => {
  if (node.getIcon) {
    const icon = node.getIcon()
    if (icon) {
      return icon
    }
  } else if (node.icon) {
    return node.icon
  }
  // node.icon is undefined
  if (node.leaf) {
    return 'pi pi-file'
  }
  const isExpanded = expandedKeys.value?.[node.key] ?? false
  return isExpanded ? 'pi pi-folder-open' : 'pi pi-folder'
}
const fillNodeInfo = (node: TreeExplorerNode): RenderedTreeExplorerNode => {
  const children = node.children?.map(fillNodeInfo) ?? []
  const totalLeaves = node.leaf
    ? 1
    : children.reduce((acc, child) => acc + child.totalLeaves, 0)
  return {
    ...node,
    icon: getTreeNodeIcon(node),
    children,
    type: node.leaf ? 'node' : 'folder',
    totalLeaves,
    badgeText: node.getBadgeText ? node.getBadgeText() : undefined,
    isEditingLabel: node.key === renameEditingNode.value?.key
  }
}
const onNodeContentClick = async (
  e: MouseEvent,
  node: RenderedTreeExplorerNode
) => {
  if (!storeSelectionKeys) {
    selectionKeys.value = {}
  }
  if (node.handleClick) {
    await node.handleClick(e)
  }
  emit('nodeClick', node, e)
}
const menu = ref(null)
const menuTargetNode = ref<RenderedTreeExplorerNode | null>(null)
const extraMenuItems = computed(() => {
  return menuTargetNode.value?.contextMenuItems
    ? typeof menuTargetNode.value.contextMenuItems === 'function'
      ? menuTargetNode.value.contextMenuItems(menuTargetNode.value)
      : menuTargetNode.value.contextMenuItems
    : []
})
const renameEditingNode = ref<RenderedTreeExplorerNode | null>(null)
const errorHandling = useErrorHandling()
const handleNodeLabelEdit = async (
  node: RenderedTreeExplorerNode,
  newName: string
) => {
  await errorHandling.wrapWithErrorHandlingAsync(
    async () => {
      if (node.key === newFolderNode.value?.key) {
        await handleFolderCreation(newName)
      } else {
        await node.handleRename?.(newName)
      }
    },
    node.handleError,
    () => {
      renameEditingNode.value = null
    }
  )()
}
provide(InjectKeyHandleEditLabelFunction, handleNodeLabelEdit)

const { t } = useI18n()
const renameCommand = (node: RenderedTreeExplorerNode) => {
  renameEditingNode.value = node
}
const deleteCommand = async (node: RenderedTreeExplorerNode) => {
  await node.handleDelete?.()
  emit('nodeDelete', node)
}
const menuItems = computed<MenuItem[]>(() =>
  [
    getAddFolderMenuItem(menuTargetNode.value),
    {
      label: t('g.rename'),
      icon: 'pi pi-file-edit',
      command: () => renameCommand(menuTargetNode.value),
      visible: menuTargetNode.value?.handleRename !== undefined
    },
    {
      label: t('g.delete'),
      icon: 'pi pi-trash',
      command: () => deleteCommand(menuTargetNode.value),
      visible: menuTargetNode.value?.handleDelete !== undefined,
      isAsync: true // The delete command can be async
    },
    ...extraMenuItems.value
  ].map((menuItem) => ({
    ...menuItem,
    command: wrapCommandWithErrorHandler(menuItem.command, {
      isAsync: menuItem.isAsync ?? false
    })
  }))
)

const handleContextMenu = (e: MouseEvent, node: RenderedTreeExplorerNode) => {
  menuTargetNode.value = node
  emit('contextMenu', node, e)
  if (menuItems.value.filter((item) => item.visible).length > 0) {
    menu.value?.show(e)
  }
}

const wrapCommandWithErrorHandler = (
  command: (event: MenuItemCommandEvent) => void,
  { isAsync = false }: { isAsync: boolean }
) => {
  return isAsync
    ? errorHandling.wrapWithErrorHandlingAsync(
        command as (...args: any[]) => Promise<any>,
        menuTargetNode.value?.handleError
      )
    : errorHandling.wrapWithErrorHandling(
        command,
        menuTargetNode.value?.handleError
      )
}

defineExpose({
  renameCommand,
  deleteCommand,
  /**
   * The command to add a folder to a node via the context menu
   * @param targetNodeKey - The key of the node where the folder will be added under
   */
  addFolderCommand: (targetNodeKey: string) => {
    addFolderCommand(findNodeByKey(renderedRoot.value, targetNodeKey))
  }
})
</script>

<style scoped>
:deep(.tree-explorer-node-label) {
  width: 100%;
  display: flex;
  align-items: center;
  margin-left: var(--p-tree-node-gap);
  flex-grow: 1;
}

/*
 * The following styles are necessary to avoid layout shift when dragging nodes over folders.
 * By setting the position to relative on the parent and using an absolutely positioned pseudo-element,
 * we can create a visual indicator for the drop target without affecting the layout of other elements.
 */
:deep(.p-tree-node-content:has(.tree-folder)) {
  position: relative;
}

:deep(.p-tree-node-content:has(.tree-folder.can-drop))::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 1px solid var(--p-content-color);
  pointer-events: none;
}
</style>
