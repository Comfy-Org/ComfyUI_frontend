<template>
  <UiTree
    v-bind="$attrs"
    v-model:expanded="expandedNodeKeys"
    v-model:selected="selectedNode"
    :class="cn('tree-explorer bg-transparent px-2 py-0 2xl:px-4', className)"
    :items="renderedRoot.children ?? []"
    :get-key="(node) => node.key"
    :get-children="
      (node) => (node.children?.length ? node.children : undefined)
    "
  >
    <template #default="{ items }">
      <UiTreeItem
        v-for="item in items"
        :key="item._id"
        v-slot="{ isExpanded, isSelected, handleToggle }"
        :value="item.value"
        :level="item.level"
      >
        <div
          :class="
            cn(
              'tree-explorer-item group/tree-node flex min-w-0 cursor-pointer items-center gap-1 rounded-sm py-(--comfy-tree-explorer-item-padding) pr-(--comfy-tree-explorer-item-padding) outline-none hover:bg-node-component-surface-hovered focus-visible:bg-node-component-surface-hovered',
              isSelected && 'bg-node-component-surface-selected'
            )
          "
          :data-tree-key="item.value.key"
          :data-parent-key="item.parentItem?.key"
          :style="{
            paddingLeft: `calc(var(--comfy-tree-explorer-item-padding) + ${(item.level - 1) * 16}px)`
          }"
          @click="
            onNodeContentClick(
              $event,
              item.value,
              item.hasChildren ? handleToggle : undefined
            )
          "
          @contextmenu="handleContextMenu($event, item.value)"
        >
          <button
            v-if="item.hasChildren"
            type="button"
            tabindex="-1"
            class="flex size-5 shrink-0 items-center justify-center"
            :aria-label="isExpanded ? $t('g.collapse') : $t('g.expand')"
            @click.stop="handleToggle"
          >
            <i
              :class="
                cn(
                  'icon-[lucide--chevron-right] size-4 transition-transform',
                  isExpanded && 'rotate-90'
                )
              "
            />
          </button>
          <span v-else class="size-5 shrink-0" />
          <i
            :class="
              cn(item.value.icon, 'tree-explorer-node-icon size-4 shrink-0')
            "
          />
          <div class="flex min-w-0 flex-1 items-center">
            <slot
              v-if="item.value.type === 'folder'"
              name="folder"
              :node="item.value"
            >
              <TreeExplorerTreeNode :node="item.value" />
            </slot>
            <slot v-else name="node" :node="item.value">
              <TreeExplorerTreeNode :node="item.value" />
            </slot>
          </div>
        </div>
      </UiTreeItem>
    </template>
  </UiTree>
  <ContextMenu ref="menu" :model="menuItems" />
</template>
<script setup lang="ts" generic="T">
import { computed, provide, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import type { MenuItem, MenuItemCommandEvent } from '@/components/ui/menu/types'
import UiTree from '@/components/ui/tree/Tree.vue'
import UiTreeItem from '@/components/ui/tree/TreeItem.vue'
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
import { combineTrees, findNodeByKey } from '@/utils/treeUtil'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const expandedKeys = defineModel<Record<string, boolean>>('expandedKeys', {
  required: true
})
provide(InjectKeyExpandedKeys, expandedKeys)
const selectionKeys = defineModel<Record<string, boolean>>('selectionKeys')
// Tracks whether the caller has set the selectionKeys model.
const storeSelectionKeys = selectionKeys.value !== undefined

const { root, class: className } = defineProps<{
  root: TreeExplorerNode<T>
  class?: string
}>()
const emit = defineEmits<{
  (e: 'nodeClick', node: RenderedTreeExplorerNode<T>, event: MouseEvent): void
  (e: 'nodeDelete', node: RenderedTreeExplorerNode<T>): void
  (e: 'contextMenu', node: RenderedTreeExplorerNode<T>, event: MouseEvent): void
}>()

const {
  newFolderNode,
  getAddFolderMenuItem,
  handleFolderCreation,
  addFolderCommand
} = useTreeFolderOperations<T>(
  /* expandNode */ (node: TreeExplorerNode<T>) => {
    expandedKeys.value[node.key] = true
  }
)

const renderedRoot = computed<RenderedTreeExplorerNode<T>>(() => {
  const renderedRoot = fillNodeInfo(root)
  return newFolderNode.value
    ? combineTrees(renderedRoot, newFolderNode.value)
    : renderedRoot
})
const expandedNodeKeys = computed({
  get: () =>
    Object.entries(expandedKeys.value)
      .filter(([, expanded]) => expanded)
      .map(([key]) => key),
  set: (keys: string[]) => {
    expandedKeys.value = Object.fromEntries(keys.map((key) => [key, true]))
  }
})
const localSelectedNode = shallowRef<RenderedTreeExplorerNode<T>>()
const selectedNode = computed({
  get: () => {
    if (!storeSelectionKeys) return localSelectedNode.value
    const key = Object.keys(selectionKeys.value ?? {}).find(
      (key) => selectionKeys.value?.[key]
    )
    return key
      ? (findNodeByKey(renderedRoot.value, key) ?? undefined)
      : undefined
  },
  set: (node: RenderedTreeExplorerNode<T> | undefined) => {
    if (storeSelectionKeys) {
      selectionKeys.value = node ? { [node.key]: true } : {}
    } else {
      localSelectedNode.value = node
    }
  }
})
const getTreeNodeIcon = (node: TreeExplorerNode<T>) => {
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
const fillNodeInfo = (
  node: TreeExplorerNode<T>
): RenderedTreeExplorerNode<T> => {
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
  node: RenderedTreeExplorerNode<T>,
  handleToggle?: () => void
) => {
  handleToggle?.()
  if (node.handleClick) {
    await node.handleClick(e)
  }
  emit('nodeClick', node, e)
}
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuTargetNode = shallowRef<RenderedTreeExplorerNode<T> | null>(null)
const extraMenuItems = computed(() => {
  const node = menuTargetNode.value
  return node?.contextMenuItems
    ? typeof node.contextMenuItems === 'function'
      ? node.contextMenuItems(node)
      : node.contextMenuItems
    : []
})
const renameEditingNode = shallowRef<RenderedTreeExplorerNode<T> | null>(null)
const errorHandling = useErrorHandling()
const handleNodeLabelEdit = async (
  n: RenderedTreeExplorerNode,
  newName: string
) => {
  const node = n as RenderedTreeExplorerNode<T>
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
const renameCommand = (node: RenderedTreeExplorerNode<T>) => {
  renameEditingNode.value = node
}
const deleteCommand = async (node: RenderedTreeExplorerNode<T>) => {
  await node.handleDelete?.()
  emit('nodeDelete', node)
}
const menuItems = computed<MenuItem[]>(() => {
  const node = menuTargetNode.value
  return [
    getAddFolderMenuItem(node),
    {
      label: t('g.rename'),
      icon: 'pi pi-file-edit',
      command: () => {
        if (node) {
          renameCommand(node)
        }
      },
      visible: node?.handleRename !== undefined
    },
    {
      label: t('g.delete'),
      icon: 'pi pi-trash',
      command: async () => {
        if (node) {
          await deleteCommand(node)
        }
      },
      visible: node?.handleDelete !== undefined,
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
})

const handleContextMenu = (
  e: MouseEvent,
  node: RenderedTreeExplorerNode<T>
) => {
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
  const node = menuTargetNode.value
  return isAsync
    ? errorHandling.wrapWithErrorHandlingAsync(
        command as (event: MenuItemCommandEvent) => Promise<void>,
        node?.handleError
      )
    : errorHandling.wrapWithErrorHandling(command, node?.handleError)
}

defineExpose({
  /**
   * The command to add a folder to a node via the context menu
   * @param targetNodeKey - The key of the node where the folder will be added under
   */
  addFolderCommand: (targetNodeKey: string) => {
    const targetNode = findNodeByKey(renderedRoot.value, targetNodeKey)
    if (targetNode) {
      addFolderCommand(targetNode)
    }
  }
})
</script>
