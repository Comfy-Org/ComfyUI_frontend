<template>
  <SidebarTabTemplate :title="$t('sideToolbar.nodeLibrary')">
    <template #tool-buttons>
      <Button
        class="new-folder-button"
        icon="pi pi-folder-plus"
        text
        severity="secondary"
        @click="addNewBookmarkFolder()"
        v-tooltip="$t('newFolder')"
      />
      <Button
        class="sort-button"
        :icon="alphabeticalSort ? 'pi pi-sort-alpha-down' : 'pi pi-sort-alt'"
        text
        severity="secondary"
        @click="alphabeticalSort = !alphabeticalSort"
        v-tooltip="$t('sideToolbar.nodeLibraryTab.sortOrder')"
      />
    </template>
    <template #body>
      <SearchBox
        class="node-lib-search-box"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        @show-filter="($event) => searchFilter.toggle($event)"
        @remove-filter="onRemoveFilter"
        :placeholder="$t('searchNodes') + '...'"
        filter-icon="pi pi-filter"
        :filters
      />

      <Popover ref="searchFilter" class="node-lib-filter-popup">
        <NodeSearchFilter @addFilter="onAddFilter" />
      </Popover>

      <NodeTreeExplorer
        :roots="renderedBookmarkedRoot.children"
        v-model:expandedKeys="expandedKeys"
        @nodeClick="handleNodeClick"
      />
      <Divider />
      <NodeTreeExplorer
        :roots="renderedRoot.children"
        v-model:expandedKeys="expandedKeys"
        @nodeClick="handleNodeClick"
      />
    </template>
  </SidebarTabTemplate>
  <div id="node-library-node-preview-container" />

  <!-- <FolderCustomizationDialog
    v-model="showCustomizationDialog"
    @confirm="updateCustomization"
    :initialIcon="initialIcon"
    :initialColor="initialColor"
  /> -->
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import {
  buildNodeDefTree,
  ComfyNodeDefImpl,
  useNodeDefStore
} from '@/stores/nodeDefStore'
import { computed, nextTick, ref, Ref } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import Popover from 'primevue/popover'
import Divider from 'primevue/divider'
import SearchBox from '@/components/common/SearchBox.vue'
import FolderCustomizationDialog from '@/components/common/CustomizationDialog.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { app } from '@/scripts/app'
import { findNodeByKey, sortedTree } from '@/utils/treeUtil'
import { useTreeExpansion } from '@/hooks/treeHooks'
import type { MenuItem } from 'primevue/menuitem'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import { FilterAndValue } from '@/services/nodeSearchService'
import { SearchFilter } from '@/components/common/SearchFilterChip.vue'
import NodeTreeExplorer from './nodeLibrary/NodeTreeExplorer.vue'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'

const { t } = useI18n()
const toast = useToast()
const nodeDefStore = useNodeDefStore()
const { expandedKeys, expandNode, toggleNodeOnEvent } = useTreeExpansion()

const searchFilter = ref(null)
const alphabeticalSort = ref(false)

const searchQuery = ref<string>('')

const nodeBookmarkStore = useNodeBookmarkStore()
const renderedBookmarkedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(
  () => {
    const fillNodeInfo = (
      node: TreeNode
    ): TreeExplorerNode<ComfyNodeDefImpl> => {
      const children = node.children?.map(fillNodeInfo)

      return {
        key: node.key,
        label: node.label,
        leaf: node.leaf,
        data: node.data,
        getIcon: (node: TreeExplorerNode<ComfyNodeDefImpl>) => {
          if (node.leaf) {
            return 'pi pi-circle-fill'
          }
          const customization =
            nodeBookmarkStore.bookmarksCustomization[node.data.nodePath]
          return customization?.icon
            ? 'pi ' + customization.icon
            : 'pi pi-bookmark-fill'
        },
        children,
        draggable: node.leaf,
        droppable: !node.leaf,
        ...(node.leaf
          ? {}
          : {
              handleRename: (
                node: TreeExplorerNode<ComfyNodeDefImpl>,
                newName: string
              ) => {
                nodeBookmarkStore.renameBookmarkFolder(node.data, newName)
              },
              handleDelete: (node: TreeExplorerNode<ComfyNodeDefImpl>) => {
                nodeBookmarkStore.deleteBookmarkFolder(node.data)
              }
            })
      }
    }
    return fillNodeInfo(nodeBookmarkStore.bookmarkedRoot)
  }
)

const root = computed(() => {
  const root = filteredRoot.value || nodeDefStore.nodeTree
  return alphabeticalSort.value ? sortedTree(root) : root
})

const renderedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(() => {
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyNodeDefImpl> => {
    const children = node.children?.map(fillNodeInfo)

    return {
      key: node.key,
      label: node.label,
      leaf: node.leaf,
      data: node.data,
      getIcon: (node: TreeExplorerNode<ComfyNodeDefImpl>) => {
        if (node.leaf) {
          return 'pi pi-circle-fill'
        }
      },
      children,
      draggable: node.leaf
    }
  }
  return fillNodeInfo(root.value)
})

const filteredRoot = ref<TreeNode | null>(null)
const filters: Ref<Array<SearchFilter & { filter: FilterAndValue<string> }>> =
  ref([])
const handleSearch = (query: string) => {
  if (query.length < 3 && !filters.value.length) {
    filteredRoot.value = null
    expandedKeys.value = {}
    return
  }

  const f = filters.value.map((f) => f.filter as FilterAndValue<string>)
  const matchedNodes = nodeDefStore.nodeSearchService.searchNode(
    query,
    f,
    {
      limit: 64
    },
    {
      matchWildcards: false
    }
  )

  filteredRoot.value = buildNodeDefTree(matchedNodes)
  expandNode(filteredRoot.value)
}

const insertNode = (nodeDef: ComfyNodeDefImpl) => {
  app.addNodeOnGraph(nodeDef, { pos: app.getCanvasCenter() })
}

const handleNodeClick = (
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
  e: MouseEvent
) => {
  if (node.leaf) {
    insertNode(node.data)
  } else {
    toggleNodeOnEvent(e, node)
  }
}

// const menuItems = computed<MenuItem[]>(() => [
//   {
//     label: t('newFolder'),
//     icon: 'pi pi-folder-plus',
//     command: () => {
//       if (menuTargetNode.value?.data) {
//         addNewBookmarkFolder(menuTargetNode.value?.data)
//       }
//     }
//   },
//   {
//     label: t('delete'),
//     icon: 'pi pi-trash',
//     command: () => {
//       if (menuTargetNode.value?.data) {
//         nodeBookmarkStore.deleteBookmarkFolder(menuTargetNode.value.data)
//       }
//     }
//   },
//   {
//     label: t('rename'),
//     icon: 'pi pi-file-edit',
//     command: () => {
//       renameEditingNode.value = menuTargetNode.value
//     }
//   },
//   {
//     label: t('customize'),
//     icon: 'pi pi-palette',
//     command: () => {
//       initialIcon.value =
//         nodeBookmarkStore.bookmarksCustomization[
//           menuTargetNode.value.data.nodePath
//         ]?.icon || nodeBookmarkStore.defaultBookmarkIcon
//       initialColor.value =
//         nodeBookmarkStore.bookmarksCustomization[
//           menuTargetNode.value.data.nodePath
//         ]?.color || nodeBookmarkStore.defaultBookmarkColor
//       showCustomizationDialog.value = true
//     }
//   }
// ])

// const handleContextMenu = (node: TreeNode, e: MouseEvent) => {
//   const nodeDef = node.data as ComfyNodeDefImpl
//   if (nodeDef?.isDummyFolder) {
//     menuTargetNode.value = node
//     menu.value?.show(e)
//   }
// }

// const handleRename = (node: TreeNode, newName: string) => {
//   if (node.data && node.data.isDummyFolder) {
//     try {
//       nodeBookmarkStore.renameBookmarkFolder(node.data, newName)
//     } catch (e) {
//       toast.add({
//         severity: 'error',
//         summary: t('error'),
//         detail: e.message,
//         life: 3000
//       })
//     }
//   }
//   renameEditingNode.value = null
// }

const addNewBookmarkFolder = (parent?: ComfyNodeDefImpl) => {
  const newFolderKey =
    'root/' + nodeBookmarkStore.addNewBookmarkFolder(parent).slice(0, -1)
  nextTick(() => {
    // renameEditingNode.value = findNodeByKey(renderedRoot.value, newFolderKey)
  })
}

// const showCustomizationDialog = ref(false)
// const initialIcon = ref(nodeBookmarkStore.defaultBookmarkIcon)
// const initialColor = ref(nodeBookmarkStore.defaultBookmarkColor)
// const updateCustomization = (icon: string, color: string) => {
//   if (menuTargetNode.value?.data) {
//     nodeBookmarkStore.updateBookmarkCustomization(
//       menuTargetNode.value.data.nodePath,
//       { icon, color }
//     )
//   }
// }

const onAddFilter = (filterAndValue: FilterAndValue) => {
  filters.value.push({
    filter: filterAndValue,
    badge: filterAndValue[0].invokeSequence.toUpperCase(),
    badgeClass: filterAndValue[0].invokeSequence + '-badge',
    text: filterAndValue[1],
    id: +new Date()
  })

  handleSearch(searchQuery.value)
}

const onRemoveFilter = (filterAndValue) => {
  const index = filters.value.findIndex((f) => f === filterAndValue)
  if (index !== -1) {
    filters.value.splice(index, 1)
  }
  handleSearch(searchQuery.value)
}
</script>

<style>
.node-lib-filter-popup {
  margin-left: -13px;
}
</style>

<style scoped>
:deep(.node-lib-search-box) {
  @apply mx-4 mt-4;
}

:deep(.comfy-vue-side-bar-body) {
  background: var(--p-tree-background);
}
</style>
