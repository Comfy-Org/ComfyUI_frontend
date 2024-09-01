<template>
  <SidebarTabTemplate :title="$t('sideToolbar.nodeLibrary')">
    <template #tool-buttons>
      <Button
        class="new-folder-button"
        icon="pi pi-folder-plus"
        text
        severity="secondary"
        @click="nodeBookmarkTreeExplorerRef?.addNewBookmarkFolder()"
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

      <NodeBookmarkTreeExplorer ref="nodeBookmarkTreeExplorerRef" />
      <Divider />
      <TreeExplorer
        class="node-lib-tree-explorer"
        :roots="renderedRoot.children"
        v-model:expandedKeys="expandedKeys"
        @nodeClick="handleNodeClick"
      >
        <template #node="{ node }">
          <NodeTreeLeaf :node="node" />
        </template>
      </TreeExplorer>
    </template>
  </SidebarTabTemplate>
  <div id="node-library-node-preview-container" />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import {
  buildNodeDefTree,
  ComfyNodeDefImpl,
  useNodeDefStore
} from '@/stores/nodeDefStore'
import { computed, ref, Ref } from 'vue'
import type { TreeNode } from 'primevue/treenode'
import Popover from 'primevue/popover'
import Divider from 'primevue/divider'
import SearchBox from '@/components/common/SearchBox.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import NodeBookmarkTreeExplorer from './nodeLibrary/NodeBookmarkTreeExplorer.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import NodeTreeLeaf from '@/components/sidebar/tabs/nodeLibrary/NodeTreeLeaf.vue'
import { app } from '@/scripts/app'
import { sortedTree } from '@/utils/treeUtil'
import { useTreeExpansion } from '@/hooks/treeHooks'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import { FilterAndValue } from '@/services/nodeSearchService'
import { SearchFilter } from '@/components/common/SearchFilterChip.vue'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerNode
} from '@/types/treeExplorerTypes'

const nodeDefStore = useNodeDefStore()
const { expandedKeys, expandNode, toggleNodeOnEvent } = useTreeExpansion()

const nodeBookmarkTreeExplorerRef = ref<InstanceType<
  typeof NodeBookmarkTreeExplorer
> | null>(null)
const searchFilter = ref(null)
const alphabeticalSort = ref(false)

const searchQuery = ref<string>('')

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

const handleNodeClick = (
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
  e: MouseEvent
) => {
  if (node.leaf) {
    app.addNodeOnGraph(node.data, { pos: app.getCanvasCenter() })
  } else {
    toggleNodeOnEvent(e, node)
  }
}

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

:deep(.node-lib-bookmark-tree-explorer) {
  padding-bottom: 0px;
}

:deep(.node-lib-tree-explorer) {
  padding-top: 0px;
}
</style>
