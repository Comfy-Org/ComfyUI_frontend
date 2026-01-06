<template>
  <div
    ref="treeContainerRef"
    class="tree-container overflow-y-auto max-h-[calc(100vh-144px)]"
  >
    <Tree
      v-model:expanded-keys="expandedKeys"
      v-model:selection-keys="selectionKeys"
      class="tree-explorer px-2 py-0 2xl:px-4 bg-transparent"
      :class="props.class"
      :value="displayRoot.children"
      selection-mode="single"
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
        }),
        nodeChildren: ({ instance }) => getNodeChildrenStyle(instance)
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
  </div>
  <ContextMenu ref="menu" :model="menuItems" />
</template>
<script setup lang="ts">
import { useElementSize, useScroll } from '@vueuse/core'
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
  InjectKeyHandleEditLabelFunction
} from '@/types/treeExplorerTypes'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'
import { combineTrees } from '@/utils/treeUtil'
import type { WindowRange } from '@/utils/virtualListUtils'
import {
  applyWindow,
  calculateSpacerHeights,
  createInitialWindowRange
} from '@/utils/virtualListUtils'

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

const DEFAULT_NODE_HEIGHT = 32
const SCROLL_THROTTLE = 64

const treeContainerRef = ref<HTMLDivElement | null>(null)
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuTargetNode = ref<RenderedTreeExplorerNode | null>(null)
const renameEditingNode = ref<RenderedTreeExplorerNode | null>(null)

const { height: containerHeight } = useElementSize(treeContainerRef)
const { y: scrollY } = useScroll(treeContainerRef, {
  throttle: SCROLL_THROTTLE,
  eventListenerOptions: { passive: true }
})

// Computed values for window calculation
const viewRows = computed(() =>
  containerHeight.value
    ? Math.ceil(containerHeight.value / DEFAULT_NODE_HEIGHT)
    : 0
)
const bufferRows = computed(() => Math.max(1, Math.floor(viewRows.value / 3)))
const windowSize = computed(() => viewRows.value + bufferRows.value * 2)

// Compute window ranges for all nodes based on scroll position
// Each node's window is calculated relative to its children list
const parentWindowRanges = computed<Record<string, WindowRange>>(() => {
  if (!containerHeight.value || !renderedRoot.value.children) {
    return {}
  }

  const ranges: Record<string, WindowRange> = {}
  const scrollTop = scrollY.value
  const scrollBottom = scrollTop + containerHeight.value

  // Calculate cumulative positions for nodes in the tree
  const nodePositions = new Map<string, number>()
  let currentPos = 0

  const calculatePositions = (node: RenderedTreeExplorerNode): number => {
    const nodeStart = currentPos
    nodePositions.set(node.key, nodeStart)
    currentPos += DEFAULT_NODE_HEIGHT

    if (node.children && !node.leaf && expandedKeys.value?.[node.key]) {
      for (const child of node.children) {
        currentPos = calculatePositions(child)
      }
    }

    return currentPos
  }

  for (const child of renderedRoot.value.children) {
    currentPos = calculatePositions(child)
  }

  // Compute windows for each node based on scroll position
  const computeNodeWindow = (node: RenderedTreeExplorerNode) => {
    if (!node.children || node.leaf) return

    const isExpanded = expandedKeys.value?.[node.key] ?? false
    if (!isExpanded) return

    const nodeStart = nodePositions.get(node.key) ?? 0
    const childrenStart = nodeStart + DEFAULT_NODE_HEIGHT
    const childrenEnd =
      childrenStart + node.children.length * DEFAULT_NODE_HEIGHT

    // Check if this node's children are in the visible range
    const isVisible =
      childrenEnd >= scrollTop - bufferRows.value * DEFAULT_NODE_HEIGHT &&
      childrenStart <= scrollBottom + bufferRows.value * DEFAULT_NODE_HEIGHT

    const totalChildren = node.children.length

    if (isVisible && totalChildren > 0) {
      // Calculate which children should be visible based on scroll position
      const relativeScrollTop = Math.max(0, scrollTop - childrenStart)
      const relativeScrollBottom = Math.max(0, scrollBottom - childrenStart)

      const fromRow = Math.max(
        0,
        Math.floor(relativeScrollTop / DEFAULT_NODE_HEIGHT) - bufferRows.value
      )
      const toRow = Math.min(
        totalChildren,
        Math.ceil(relativeScrollBottom / DEFAULT_NODE_HEIGHT) + bufferRows.value
      )

      ranges[node.key] = {
        start: Math.max(0, fromRow),
        end: Math.min(
          totalChildren,
          Math.max(fromRow + windowSize.value, toRow)
        )
      }
    } else {
      // Node is outside visible range, use minimal window
      ranges[node.key] = createInitialWindowRange(
        totalChildren,
        windowSize.value
      )
    }

    // Recursively compute windows for children
    const range = ranges[node.key]
    for (let i = range.start; i < range.end && i < node.children.length; i++) {
      computeNodeWindow(node.children[i])
    }
  }

  for (const child of renderedRoot.value.children) {
    computeNodeWindow(child)
  }

  return ranges
})

const getTreeNodeIcon = (node: TreeExplorerNode): string => {
  if (node.getIcon) {
    const icon = node.getIcon()
    if (icon) return icon
  }
  if (node.icon) return node.icon

  if (node.leaf) return 'pi pi-file'

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
    badgeText: node.getBadgeText?.() ?? undefined,
    isEditingLabel: node.key === renameEditingNode.value?.key
  }
}

const renderedRoot = computed<RenderedTreeExplorerNode>(() => {
  const root = fillNodeInfo(props.root)
  return newFolderNode.value ? combineTrees(root, newFolderNode.value) : root
})

// Build a lookup map for O(1) node access instead of O(n) tree traversal
const nodeKeyMap = computed<Record<string, RenderedTreeExplorerNode>>(() => {
  const map: Record<string, RenderedTreeExplorerNode> = {}
  const buildMap = (node: RenderedTreeExplorerNode) => {
    map[node.key] = node
    if (node.children) {
      for (const child of node.children) {
        buildMap(child)
      }
    }
  }
  buildMap(renderedRoot.value)
  return map
})

const displayRoot = computed<RenderedTreeExplorerNode>(() => ({
  ...renderedRoot.value,
  children: (renderedRoot.value.children || []).map((node) =>
    applyWindow(node, parentWindowRanges.value, windowSize.value)
  )
}))

const getNodeChildrenStyle = (instance: any) => {
  const node = instance.node as RenderedTreeExplorerNode
  if (!node?.children || node.leaf) {
    return { class: 'virtual-node-children' }
  }

  // Use lookup map for O(1) access instead of O(n) tree traversal
  const originalNode = nodeKeyMap.value[node.key]
  if (!originalNode?.children) {
    return { class: 'virtual-node-children' }
  }

  const totalChildren = originalNode.children.length
  const range =
    parentWindowRanges.value[node.key] ??
    createInitialWindowRange(totalChildren, windowSize.value)

  const { topSpacer, bottomSpacer } = calculateSpacerHeights(
    totalChildren,
    range,
    DEFAULT_NODE_HEIGHT
  )

  return {
    class: 'virtual-node-children',
    style: {
      '--top-spacer': `${topSpacer}px`,
      '--bottom-spacer': `${bottomSpacer}px`
    }
  }
}
const errorHandling = useErrorHandling()

const onNodeContentClick = async (
  e: MouseEvent,
  node: RenderedTreeExplorerNode
): Promise<void> => {
  if (!storeSelectionKeys) {
    selectionKeys.value = {}
  }
  if (node.handleClick) {
    await errorHandling.wrapWithErrorHandlingAsync(
      () => node.handleClick?.(e),
      node.handleError
    )()
  }
  emit('nodeClick', node, e)
}

const extraMenuItems = computed(() => {
  const contextMenuItems = menuTargetNode.value?.contextMenuItems
  if (!contextMenuItems) return []
  return typeof contextMenuItems === 'function'
    ? contextMenuItems(menuTargetNode.value!)
    : contextMenuItems
})

const handleNodeLabelEdit = async (
  node: RenderedTreeExplorerNode,
  newName: string
): Promise<void> => {
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
      command: () => {
        if (menuTargetNode.value) {
          renameCommand(menuTargetNode.value)
        }
      },
      visible: menuTargetNode.value?.handleRename !== undefined
    },
    {
      label: t('g.delete'),
      icon: 'pi pi-trash',
      command: async () => {
        if (menuTargetNode.value) {
          await deleteCommand(menuTargetNode.value)
        }
      },
      visible: menuTargetNode.value?.handleDelete !== undefined,
      isAsync: true // The delete command can be async
    },
    ...extraMenuItems.value
  ].map((menuItem: MenuItem) => ({
    ...menuItem,
    command: menuItem.command
      ? wrapCommandWithErrorHandler(menuItem.command, {
          isAsync: menuItem.isAsync ?? false
        })
      : undefined
  }))
)

const handleContextMenu = (e: MouseEvent, node: RenderedTreeExplorerNode) => {
  menuTargetNode.value = node
  emit('contextMenu', node, e)
  if (menuItems.value.some((item) => item.visible)) {
    menu.value?.show(e)
  }
}

const wrapCommandWithErrorHandler = (
  command: (event: MenuItemCommandEvent) => void,
  { isAsync = false }: { isAsync: boolean }
):
  | ((event: MenuItemCommandEvent) => void)
  | ((event: MenuItemCommandEvent) => Promise<void>) => {
  return isAsync
    ? errorHandling.wrapWithErrorHandlingAsync(
        command as (event: MenuItemCommandEvent) => Promise<void>,
        menuTargetNode.value?.handleError
      )
    : errorHandling.wrapWithErrorHandling(
        command,
        menuTargetNode.value?.handleError
      )
}

defineExpose({
  /**
   * The command to add a folder to a node via the context menu
   * @param targetNodeKey - The key of the node where the folder will be added under
   */
  addFolderCommand: (targetNodeKey: string) => {
    const targetNode = nodeKeyMap.value[targetNodeKey]
    if (targetNode) {
      addFolderCommand(targetNode)
    }
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

/* Virtual scrolling spacers using CSS pseudo-elements (only for ul) */
:deep(ul.virtual-node-children)::before {
  content: '';
  display: block;
  height: var(--top-spacer, 0);
}

:deep(ul.virtual-node-children)::after {
  content: '';
  display: block;
  height: var(--bottom-spacer, 0);
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
