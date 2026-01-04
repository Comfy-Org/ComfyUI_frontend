<template>
  <Tree
    v-model:expanded-keys="expandedKeys"
    v-model:selection-keys="selectionKeys"
    class="tree-explorer px-2 py-0 2xl:px-4 bg-transparent tree-container overflow-y-auto max-h-[calc(100vh-144px)]"
    :class="props.class"
    :value="displayRoot.children"
    selection-mode="single"
    :pt="{
      root: 'tree-container overflow-y-auto max-h-[calc(100vh-144px)]',
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
  <ContextMenu ref="menu" :model="menuItems" />
</template>
<script setup lang="ts">
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import Tree from 'primevue/tree'
import { useElementSize, useScroll, whenever } from '@vueuse/core'
import { clamp, debounce } from 'es-toolkit/compat'
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue'
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

const BUFFER_ROWS = 10
const DEFAULT_NODE_HEIGHT = 28
const SCROLL_THROTTLE = 64
const RESIZE_DEBOUNCE = 64

const parentWindowRanges = ref<Record<string, WindowRange>>({})

const nodeHeight = ref(DEFAULT_NODE_HEIGHT)

const treeContainerElement = ref<HTMLElement | null>(null)

const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuTargetNode = ref<RenderedTreeExplorerNode | null>(null)
const renameEditingNode = ref<RenderedTreeExplorerNode | null>(null)

// Function to set tree container element from pt.root
const setTreeContainerElement = (el: HTMLElement | null) => {
  if (el && !treeContainerElement.value) {
    treeContainerElement.value = el
  }
}

const { height: containerHeight } = useElementSize(treeContainerElement)
const { y: scrollY } = useScroll(treeContainerElement, {
  throttle: SCROLL_THROTTLE,
  eventListenerOptions: { passive: true }
})

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

// Update windows for all nodes based on current scroll position
const updateWindows = () => {
  if (!treeContainerElement.value || !containerHeight.value) return

  const viewRows = Math.ceil(containerHeight.value / nodeHeight.value)
  const offsetRows = Math.floor(scrollY.value / nodeHeight.value)

  const updateNodeWindow = (node: RenderedTreeExplorerNode) => {
    if (!node.children || node.leaf) return

    const isExpanded = expandedKeys.value?.[node.key] ?? false
    if (!isExpanded) {
      delete parentWindowRanges.value[node.key]
      return
    }

    const totalChildren = node.children.length
    const currentRange = parentWindowRanges.value[node.key]

    if (currentRange) {
      const fromRow = Math.max(0, offsetRows - BUFFER_ROWS)
      const toRow = offsetRows + BUFFER_ROWS + viewRows
      const newStart = clamp(fromRow, 0, totalChildren)
      const newEnd = clamp(toRow, newStart, totalChildren)

      if (
        Math.abs(currentRange.start - newStart) > BUFFER_ROWS ||
        Math.abs(currentRange.end - newEnd) > BUFFER_ROWS
      ) {
        parentWindowRanges.value[node.key] = {
          start: newStart,
          end: newEnd
        }
      }
    } else {
      const windowSize = viewRows + BUFFER_ROWS * 2
      parentWindowRanges.value[node.key] = createInitialWindowRange(
        totalChildren,
        windowSize
      )
    }

    const range = parentWindowRanges.value[node.key]
    for (let i = range.start; i < range.end && i < node.children.length; i++) {
      updateNodeWindow(node.children[i])
    }
  }

  for (const child of renderedRoot.value.children || []) {
    updateNodeWindow(child)
  }
}

// Watch scroll position and update windows reactively
watch([scrollY, containerHeight, expandedKeys], updateWindows, {
  immediate: true,
  flush: 'post'
})

// Reset windows to top when scroll reaches top
whenever(
  () => scrollY.value === 0,
  () => {
    const resetNodeWindow = (node: RenderedTreeExplorerNode) => {
      if (!node.children || node.leaf) return
      const isExpanded = expandedKeys.value?.[node.key] ?? false
      if (!isExpanded) return

      const totalChildren = node.children.length
      parentWindowRanges.value[node.key] = createInitialWindowRange(
        totalChildren,
        Math.ceil((containerHeight.value / nodeHeight.value) * 2)
      )

      for (const child of node.children) {
        if (expandedKeys.value?.[child.key]) {
          resetNodeWindow(child)
        }
      }
    }

    for (const parent of renderedRoot.value.children || []) {
      resetNodeWindow(parent)
    }
  }
)

// Auto-detect node height from rendered DOM
const updateNodeHeight = () => {
  if (!treeContainerElement.value) return
  const firstNode = treeContainerElement.value.querySelector(
    '[data-tree-node]'
  ) as HTMLElement

  if (!firstNode?.clientHeight) return

  if (nodeHeight.value !== firstNode.clientHeight) {
    nodeHeight.value = firstNode.clientHeight
  }
}

const onResize = debounce(updateNodeHeight, RESIZE_DEBOUNCE)
watch([containerHeight, expandedKeys], onResize, { flush: 'post' })
onBeforeUnmount(() => {
  onResize.cancel()
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

whenever(() => renderedRoot.value, updateNodeHeight, { flush: 'post' })

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

const windowSize = computed(() => {
  if (!containerHeight.value) return 60
  return Math.ceil((containerHeight.value / nodeHeight.value) * 2)
})

const displayRoot = computed<RenderedTreeExplorerNode>(() => ({
  ...renderedRoot.value,
  children: (renderedRoot.value.children || []).map((node) =>
    applyWindow(node, parentWindowRanges.value, windowSize.value)
  )
}))

const getNodeChildrenStyle = (instance: any) => {
  const node = instance.node as RenderedTreeExplorerNode

  // Get scroll container from nodeChildren's parent element
  // instance.$el is the nodeChildren DOM element (<ul>)
  // We traverse up to find the scroll container (.tree-container)
  if (instance.$el && !treeContainerElement.value) {
    const el = instance.$el as HTMLElement
    const scrollContainer = el.closest('.tree-container') as HTMLElement
    if (scrollContainer) {
      setTreeContainerElement(scrollContainer)
    }
  }

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
    nodeHeight.value
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
