<template>
  <div
    ref="treeContainerRef"
    class="tree-container overflow-y-auto max-h-[calc(100vh-144px)]"
    @scroll="handleTreeScroll"
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
        nodeChildren: ({ instance }) =>
          getNodeChildrenStyle(instance?.node as RenderedTreeExplorerNode)
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
import { useThrottleFn } from '@vueuse/core'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import Tree from 'primevue/tree'
import { computed, provide, ref, watch } from 'vue'
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
  applyWindow as applyWindowUtil,
  calculateScrollPercentage,
  calculateSpacerHeights,
  createInitialWindowRange,
  shiftWindowBackward as shiftWindowBackwardUtil,
  shiftWindowForward as shiftWindowForwardUtil
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

// Sliding window configuration
const WINDOW_SIZE = 60
const BUFFER_SIZE = 20
const NODE_HEIGHT = 28 // Approximate height per tree node in pixels
const SCROLL_FORWARD_THRESHOLD = 0.7 // Shift window forward when scrolled past 70%
const SCROLL_BACKWARD_THRESHOLD = 0.3 // Shift window backward when scrolled below 30%

// For each parent node, track the sliding window range [start, end)
const parentWindowRanges = ref<Record<string, WindowRange>>({})

// Reset window ranges when nodes are collapsed
watch(
  expandedKeys,
  (newKeys, oldKeys) => {
    if (!oldKeys) return
    for (const key in oldKeys) {
      if (oldKeys[key] && !newKeys[key]) {
        delete parentWindowRanges.value[key]
      }
    }
  },
  { deep: true }
)

// Ref to access the tree container for scroll detection
const treeContainerRef = ref<HTMLDivElement | null>(null)

// Calculate total top and bottom spacer heights from all expanded nodes
const getTotalSpacerHeights = () => {
  let topTotal = 0
  let bottomTotal = 0

  const calculateForNode = (node: RenderedTreeExplorerNode) => {
    if (!node.children || node.leaf) return
    const isExpanded = expandedKeys.value?.[node.key] ?? false
    if (!isExpanded) return

    const totalChildren = node.children.length
    const range = parentWindowRanges.value[node.key] ?? {
      start: 0,
      end: Math.min(WINDOW_SIZE, totalChildren)
    }

    topTotal += range.start * NODE_HEIGHT
    bottomTotal += (totalChildren - range.end) * NODE_HEIGHT

    // Recursively check children in the window
    for (let i = range.start; i < range.end && i < node.children.length; i++) {
      calculateForNode(node.children[i])
    }
  }

  for (const child of renderedRoot.value.children || []) {
    calculateForNode(child)
  }

  return { topTotal, bottomTotal }
}

// Reset window to the beginning for a single node (recursive)
const resetNodeWindowToTop = (node: RenderedTreeExplorerNode) => {
  if (!node.children || node.leaf) return
  const isExpanded = expandedKeys.value?.[node.key] ?? false
  if (!isExpanded) return

  parentWindowRanges.value[node.key] = createInitialWindowRange(
    node.children.length,
    WINDOW_SIZE
  )

  // Recursively reset children
  for (const child of node.children) {
    if (expandedKeys.value?.[child.key]) {
      resetNodeWindowToTop(child)
    }
  }
}

// Reset all windows to the beginning
const resetWindowsToTop = () => {
  for (const parent of renderedRoot.value.children || []) {
    resetNodeWindowToTop(parent)
  }
}

// Scroll handler with throttling
const handleTreeScroll = useThrottleFn(() => {
  if (!treeContainerRef.value) return

  const container = treeContainerRef.value
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight

  // Special case: when scrolled to top, reset all windows to start
  if (scrollTop === 0) {
    resetWindowsToTop()
    return
  }

  const { topTotal, bottomTotal } = getTotalSpacerHeights()
  const scrollPercentage = calculateScrollPercentage(
    scrollTop,
    scrollHeight,
    clientHeight,
    topTotal,
    bottomTotal
  )

  // When scrolling near bottom (70%), shift window forward
  if (scrollPercentage > SCROLL_FORWARD_THRESHOLD) {
    shiftWindowsForward()
  }
  // When scrolling near top (30%), shift window backward
  if (scrollPercentage < SCROLL_BACKWARD_THRESHOLD) {
    shiftWindowsBackward()
  }
}, 100)

// Shift window for a single node in given direction (recursive)
type ShiftDirection = 'forward' | 'backward'
const shiftNodeWindow = (
  node: RenderedTreeExplorerNode,
  direction: ShiftDirection
) => {
  if (!node.children || node.leaf) return
  const isExpanded = expandedKeys.value?.[node.key] ?? false
  if (!isExpanded) return

  const totalChildren = node.children.length
  const range =
    parentWindowRanges.value[node.key] ??
    createInitialWindowRange(totalChildren, WINDOW_SIZE)

  const shiftFn =
    direction === 'forward' ? shiftWindowForwardUtil : shiftWindowBackwardUtil
  const newRange = shiftFn(range, totalChildren, BUFFER_SIZE, WINDOW_SIZE)

  if (newRange) {
    parentWindowRanges.value[node.key] = newRange
  }

  // Recursively process children in current window
  for (let i = range.start; i < range.end && i < node.children.length; i++) {
    shiftNodeWindow(node.children[i], direction)
  }
}

// Shift all windows in given direction
const shiftWindows = (direction: ShiftDirection) => {
  for (const parent of renderedRoot.value.children || []) {
    shiftNodeWindow(parent, direction)
  }
}

// Convenience functions for forward/backward
const shiftWindowsForward = () => shiftWindows('forward')
const shiftWindowsBackward = () => shiftWindows('backward')

const renderedRoot = computed<RenderedTreeExplorerNode>(() => {
  const renderedRoot = fillNodeInfo(props.root)
  return newFolderNode.value
    ? combineTrees(renderedRoot, newFolderNode.value)
    : renderedRoot
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

// Apply sliding window to limit visible children
const applyWindow = (
  node: RenderedTreeExplorerNode
): RenderedTreeExplorerNode =>
  applyWindowUtil(node, parentWindowRanges.value, WINDOW_SIZE)

// Final tree to display with sliding window applied
const displayRoot = computed<RenderedTreeExplorerNode>(() => {
  return {
    ...renderedRoot.value,
    children: (renderedRoot.value.children || []).map(applyWindow)
  }
})

// Get spacer heights for a node's children container
const getNodeChildrenStyle = (node: RenderedTreeExplorerNode | undefined) => {
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
    createInitialWindowRange(totalChildren, WINDOW_SIZE)

  const { topSpacer, bottomSpacer } = calculateSpacerHeights(
    totalChildren,
    range,
    NODE_HEIGHT
  )

  return {
    class: 'virtual-node-children',
    style: {
      '--top-spacer': `${topSpacer}px`,
      '--bottom-spacer': `${bottomSpacer}px`
    }
  }
}
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
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
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
