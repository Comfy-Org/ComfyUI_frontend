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
        nodeChildren: ({ instance }) =>
          getNodeChildrenStyle(instance.node as RenderedTreeExplorerNode)
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
import { applyWindow, createInitialWindowRange } from '@/utils/virtualListUtils'

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
const parentNodeWindowRanges = ref<Record<string, WindowRange>>({})

const { height: containerHeight } = useElementSize(treeContainerRef)
const { y: scrollY } = useScroll(treeContainerRef, {
  throttle: SCROLL_THROTTLE,
  eventListenerOptions: { passive: true }
})

const viewRows = computed(() =>
  containerHeight.value
    ? Math.ceil(containerHeight.value / DEFAULT_NODE_HEIGHT)
    : 0
)
const bufferRows = computed(() => Math.max(1, Math.floor(viewRows.value / 3)))
const windowSize = computed(() => viewRows.value + bufferRows.value * 2)

// Calculate positions for all nodes in the tree
const calculateNodePositions = (
  root: RenderedTreeExplorerNode
): Map<string, number> => {
  const nodePositions = new Map<string, number>()
  let currentPos = 0

  const traverse = (node: RenderedTreeExplorerNode): number => {
    const nodeStart = currentPos
    nodePositions.set(node.key, nodeStart)
    currentPos += DEFAULT_NODE_HEIGHT

    if (node.children && !node.leaf && expandedKeys.value?.[node.key]) {
      for (const child of node.children) {
        currentPos = traverse(child)
      }
    }

    return currentPos
  }

  if (root.children) {
    for (const child of root.children) {
      currentPos = traverse(child)
    }
  }

  return nodePositions
}

const getFullNodeHeight = (node: RenderedTreeExplorerNode): number => {
  let height = DEFAULT_NODE_HEIGHT

  if (node.children && !node.leaf && expandedKeys.value?.[node.key]) {
    for (const child of node.children) {
      height += getFullNodeHeight(child)
    }
  }

  return height
}

const calculateNodeWindowRange = (
  node: RenderedTreeExplorerNode,
  nodePositions: Map<string, number>,
  scrollTop: number,
  scrollBottom: number,
  bufferHeight: number
): WindowRange | null => {
  if (!node.children || node.leaf) return null

  const isExpanded = expandedKeys.value?.[node.key] ?? false
  if (!isExpanded) return null

  const totalChildren = node.children.length
  if (totalChildren === 0) return null

  const nodeStart = nodePositions.get(node.key) ?? 0
  const childrenStart = nodeStart + DEFAULT_NODE_HEIGHT

  const lastChild = node.children[node.children.length - 1]
  const lastChildStart = nodePositions.get(lastChild.key) ?? childrenStart
  const lastChildHeight = getFullNodeHeight(lastChild)
  const childrenEnd = lastChildStart + lastChildHeight

  const isAboveView = childrenEnd < scrollTop - bufferHeight
  const isBelowView = childrenStart > scrollBottom + bufferHeight

  if (isAboveView) {
    const endRow = Math.max(0, totalChildren - windowSize.value)
    return { start: endRow, end: totalChildren }
  }

  if (isBelowView) {
    return { start: 0, end: Math.min(windowSize.value, totalChildren) }
  }

  let startIndex = 0
  let endIndex = totalChildren

  for (let i = 0; i < totalChildren; i++) {
    const child = node.children[i]
    const childStart = nodePositions.get(child.key) ?? 0
    const childHeight = getFullNodeHeight(child)
    const childEnd = childStart + childHeight

    if (childEnd < scrollTop - bufferHeight) {
      startIndex = i + 1
    }
    if (childStart <= scrollBottom + bufferHeight) {
      endIndex = i + 1
    }
  }

  startIndex = Math.max(0, startIndex - bufferRows.value)
  endIndex = Math.min(totalChildren, endIndex + bufferRows.value)

  if (endIndex - startIndex < windowSize.value) {
    endIndex = Math.min(totalChildren, startIndex + windowSize.value)
  }

  return { start: startIndex, end: endIndex }
}

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

const mergeRanges = (
  existing: WindowRange | undefined,
  calculated: WindowRange,
  totalChildren: number
): { range: WindowRange; changed: boolean } => {
  if (!existing) {
    return { range: calculated, changed: true }
  }

  const needsStartExpansion = calculated.start < existing.start
  const hasExcessAtStart =
    existing.start > 0 && calculated.start > existing.start + bufferRows.value
  const needsEndExpansion = calculated.end > existing.end
  const hasExcessAtEnd =
    existing.end < totalChildren &&
    calculated.end < existing.end - bufferRows.value

  const updateStart = needsStartExpansion || hasExcessAtStart
  const updateEnd = needsEndExpansion || hasExcessAtEnd

  let newStart = updateStart ? calculated.start : existing.start
  let newEnd = updateEnd ? calculated.end : existing.end

  if (newEnd - newStart > windowSize.value * 2) {
    if (needsStartExpansion) {
      newEnd = Math.min(totalChildren, newStart + windowSize.value * 2)
    } else {
      newStart = Math.max(0, newEnd - windowSize.value * 2)
    }
  }

  const changed =
    updateStart || updateEnd || newStart !== existing.start || newEnd !== existing.end

  return { range: { start: newStart, end: newEnd }, changed }
}

const updateVisibleParentRanges = () => {
  if (!containerHeight.value || !renderedRoot.value.children) {
    return
  }

  const scrollTop = scrollY.value
  const scrollBottom = scrollTop + containerHeight.value
  const bufferHeight = bufferRows.value * DEFAULT_NODE_HEIGHT
  const nodePositions = calculateNodePositions(renderedRoot.value)

  const currentRanges = parentNodeWindowRanges.value
  const newRanges: Record<string, WindowRange> = {}
  let hasChanges = false

  const processNode = (node: RenderedTreeExplorerNode) => {
    if (!node.children || node.leaf) return

    const isExpanded = expandedKeys.value?.[node.key] ?? false
    if (!isExpanded) return

    const calculated = calculateNodeWindowRange(
      node,
      nodePositions,
      scrollTop,
      scrollBottom,
      bufferHeight
    )

    if (calculated) {
      const existing = currentRanges[node.key]
      const { range, changed } = mergeRanges(
        existing,
        calculated,
        node.children.length
      )
      newRanges[node.key] = range
      if (changed) {
        hasChanges = true
      }
    }

    for (const child of node.children) {
      processNode(child)
    }
  }

  for (const child of renderedRoot.value.children) {
    processNode(child)
  }

  if (hasChanges || Object.keys(newRanges).length !== Object.keys(currentRanges).length) {
    parentNodeWindowRanges.value = newRanges
  }
}

watch([scrollY, containerHeight], updateVisibleParentRanges, { immediate: true })

watch(
  expandedKeys,
  () => {
    updateVisibleParentRanges()
  },
  { deep: true }
)

const displayRoot = computed<RenderedTreeExplorerNode>(() => ({
  ...renderedRoot.value,
  children: (renderedRoot.value.children || []).map((node) =>
    applyWindow(node, parentNodeWindowRanges.value, windowSize.value)
  )
}))

const calculateRealSpacerHeights = (
  originalChildren: RenderedTreeExplorerNode[],
  range: WindowRange
): { topSpacer: number; bottomSpacer: number } => {
  let topSpacer = 0
  let bottomSpacer = 0

  for (let i = 0; i < range.start; i++) {
    topSpacer += getFullNodeHeight(originalChildren[i])
  }

  for (let i = range.end; i < originalChildren.length; i++) {
    bottomSpacer += getFullNodeHeight(originalChildren[i])
  }

  return { topSpacer, bottomSpacer }
}

const getNodeChildrenStyle = (node: RenderedTreeExplorerNode) => {
  if (!node || node.leaf) {
    return { class: 'virtual-node-children' }
  }

  const originalNode = nodeKeyMap.value[node.key]
  if (!originalNode?.children || originalNode.children.length === 0) {
    return { class: 'virtual-node-children' }
  }

  const isExpanded = expandedKeys.value?.[node.key] ?? false
  if (!isExpanded) {
    return { class: 'virtual-node-children' }
  }

  const range =
    parentNodeWindowRanges.value[node.key] ??
    createInitialWindowRange(originalNode.children.length, windowSize.value)

  const { topSpacer, bottomSpacer } = calculateRealSpacerHeights(
    originalNode.children,
    range
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
  },
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
