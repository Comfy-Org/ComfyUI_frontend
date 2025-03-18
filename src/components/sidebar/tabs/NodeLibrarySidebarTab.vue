<template>
  <SidebarTabTemplate
    :title="$t('sideToolbar.nodeLibrary')"
    class="bg-[var(--p-tree-background)]"
  >
    <template #tool-buttons>
      <Button
        class="new-folder-button"
        icon="pi pi-folder-plus"
        text
        severity="secondary"
        @click="nodeBookmarkTreeExplorerRef?.addNewBookmarkFolder()"
        v-tooltip.bottom="$t('g.newFolder')"
      />
      <Button
        class="sort-button"
        :icon="alphabeticalSort ? 'pi pi-sort-alpha-down' : 'pi pi-sort-alt'"
        text
        severity="secondary"
        @click="alphabeticalSort = !alphabeticalSort"
        v-tooltip.bottom="$t('sideToolbar.nodeLibraryTab.sortOrder')"
      />
    </template>
    <template #header>
      <SearchBox
        class="node-lib-search-box p-2 2xl:p-4"
        v-model:modelValue="searchQuery"
        @search="handleSearch"
        @show-filter="($event) => searchFilter?.toggle($event)"
        @remove-filter="onRemoveFilter"
        :placeholder="$t('g.searchNodes') + '...'"
        filter-icon="pi pi-filter"
        :filters
      />

      <Popover ref="searchFilter" class="ml-[-13px]">
        <NodeSearchFilter @addFilter="onAddFilter" />
      </Popover>
    </template>
    <template #body>
      <NodeBookmarkTreeExplorer
        ref="nodeBookmarkTreeExplorerRef"
        :filtered-node-defs="filteredNodeDefs"
      />
      <Divider
        v-show="nodeBookmarkStore.bookmarks.length > 0"
        type="dashed"
        class="m-2"
      />
      <TreeExplorer
        class="node-lib-tree-explorer"
        :root="renderedRoot"
        v-model:expandedKeys="expandedKeys"
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
import Divider from 'primevue/divider'
import Popover from 'primevue/popover'
import type { TreeNode } from 'primevue/treenode'
import { Ref, computed, h, nextTick, ref, render } from 'vue'

import SearchBox from '@/components/common/SearchBox.vue'
import { SearchFilter } from '@/components/common/SearchFilterChip.vue'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import NodeTreeLeaf from '@/components/sidebar/tabs/nodeLibrary/NodeTreeLeaf.vue'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useLitegraphService } from '@/services/litegraphService'
import { FilterAndValue } from '@/services/nodeSearchService'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import {
  ComfyNodeDefImpl,
  buildNodeDefTree,
  useNodeDefStore
} from '@/stores/nodeDefStore'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { sortedTree } from '@/utils/treeUtil'

import NodeBookmarkTreeExplorer from './nodeLibrary/NodeBookmarkTreeExplorer.vue'

const nodeDefStore = useNodeDefStore()
const nodeBookmarkStore = useNodeBookmarkStore()
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const nodeBookmarkTreeExplorerRef = ref<InstanceType<
  typeof NodeBookmarkTreeExplorer
> | null>(null)
const searchFilter = ref<InstanceType<typeof Popover> | null>(null)
const alphabeticalSort = ref(false)

const searchQuery = ref<string>('')

const root = computed(() => {
  const root = filteredRoot.value || nodeDefStore.nodeTree
  return alphabeticalSort.value ? sortedTree(root, { groupLeaf: true }) : root
})

const renderedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(() => {
  const fillNodeInfo = (node: TreeNode): TreeExplorerNode<ComfyNodeDefImpl> => {
    const children = node.children?.map(fillNodeInfo)

    return {
      key: node.key,
      label: node.leaf ? node.data.display_name : node.label,
      leaf: node.leaf,
      data: node.data,
      getIcon() {
        if (this.leaf) {
          return 'pi pi-circle-fill'
        }
      },
      children,
      draggable: node.leaf,
      renderDragPreview(container) {
        const vnode = h(NodePreview, { nodeDef: node.data })
        render(vnode, container)
        return () => {
          render(null, container)
        }
      },
      handleClick(e: MouseEvent) {
        if (this.leaf) {
          useLitegraphService().addNodeOnGraph(this.data)
        } else {
          toggleNodeOnEvent(e, this)
        }
      }
    }
  }
  return fillNodeInfo(root.value)
})

const filteredNodeDefs = ref<ComfyNodeDefImpl[]>([])
const filteredRoot = computed<TreeNode | null>(() => {
  if (!filteredNodeDefs.value.length) {
    return null
  }
  return buildNodeDefTree(filteredNodeDefs.value)
})
const filters: Ref<Array<SearchFilter & { filter: FilterAndValue<string> }>> =
  ref([])
const handleSearch = (query: string) => {
  // Don't apply a min length filter because it does not make sense in
  // multi-byte languages like Chinese, Japanese, Korean, etc.
  if (query.length === 0 && !filters.value.length) {
    filteredNodeDefs.value = []
    expandedKeys.value = {}
    return
  }

  const f = filters.value.map((f) => f.filter as FilterAndValue<string>)
  filteredNodeDefs.value = nodeDefStore.nodeSearchService.searchNode(
    query,
    f,
    {
      limit: 64
    },
    {
      matchWildcards: false
    }
  )

  nextTick(() => {
    expandNode(filteredRoot.value)
  })
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
