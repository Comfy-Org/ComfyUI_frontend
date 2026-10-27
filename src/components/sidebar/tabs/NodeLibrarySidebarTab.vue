<template>
  <div class="h-full">
    <SidebarTabTemplate
      v-if="!isHelpOpen"
      :title="$t('sideToolbar.nodeLibrary')"
    >
      <template #tool-buttons>
        <Button
          :tooltip="$t('g.newFolder')"
          tooltip-side="bottom"
          class="new-folder-button"
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('g.newFolder')"
          @click="nodeBookmarkTreeExplorerRef?.addNewBookmarkFolder()"
        >
          <i class="icon-[lucide--folder-plus]" />
        </Button>
        <PopoverRoot v-slot="{ close }">
          <PopoverTrigger as-child>
            <Button
              :tooltip="$t('sideToolbar.nodeLibraryTab.groupBy')"
              tooltip-side="bottom"
              variant="muted-textonly"
              size="icon"
              :aria-label="$t('sideToolbar.nodeLibraryTab.groupBy')"
            >
              <i :class="selectedGroupingIcon" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            class="max-h-(--reka-popover-content-available-height) w-auto max-w-(--reka-popover-content-available-width) overflow-auto rounded-lg border-border/50 p-0 shadow-lg data-[state=open]:animate-none"
            dismiss-on-viewport-change
          >
            <div class="flex flex-col gap-1 p-2">
              <Button
                v-for="option in groupingOptions"
                :key="option.id"
                :variant="
                  selectedGroupingId === option.id ? 'primary' : 'textonly'
                "
                class="justify-start"
                @click="
                  () => {
                    selectGrouping(option.id)
                    close()
                  }
                "
              >
                <i :class="option.icon" />
                {{ $t(option.label) }}
              </Button>
            </div>
          </PopoverContent>
        </PopoverRoot>
        <PopoverRoot v-slot="{ close }">
          <PopoverTrigger as-child>
            <Button
              :tooltip="$t('sideToolbar.nodeLibraryTab.sortMode')"
              tooltip-side="bottom"
              variant="muted-textonly"
              size="icon"
              :aria-label="$t('sideToolbar.nodeLibraryTab.sortMode')"
            >
              <i :class="selectedSortingIcon" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            class="max-h-(--reka-popover-content-available-height) w-auto max-w-(--reka-popover-content-available-width) overflow-auto rounded-lg border-border/50 p-0 shadow-lg data-[state=open]:animate-none"
            dismiss-on-viewport-change
          >
            <div class="flex flex-col gap-1 p-2">
              <Button
                v-for="option in sortingOptions"
                :key="option.id"
                :variant="
                  selectedSortingId === option.id ? 'primary' : 'textonly'
                "
                class="justify-start"
                @click="
                  () => {
                    selectSorting(option.id)
                    close()
                  }
                "
              >
                <i :class="option.icon" />
                {{ $t(option.label) }}
              </Button>
            </div>
          </PopoverContent>
        </PopoverRoot>
        <Button
          :tooltip="$t('sideToolbar.nodeLibraryTab.resetView')"
          tooltip-side="bottom"
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('sideToolbar.nodeLibraryTab.resetView')"
          @click="resetOrganization"
        >
          <i class="icon-[lucide--filter-x]" />
        </Button>
        <Button
          :tooltip="$t('menu.refresh')"
          tooltip-side="bottom"
          variant="muted-textonly"
          size="icon"
          :aria-label="$t('menu.refresh')"
          @click="() => commandStore.execute('Comfy.RefreshNodeDefinitions')"
        >
          <i class="icon-[lucide--refresh-cw]" />
        </Button>
      </template>
      <template #header>
        <SidebarTopArea>
          <SearchInput
            ref="searchBoxRef"
            v-model="searchQuery"
            :clear-label="$t('g.clear')"
            :accessible-label="$t('g.search')"
            data-testid="node-library-search"
            class="node-lib-search-box"
            :placeholder="$t('g.searchPlaceholder', { subject: $t('g.nodes') })"
            @search="handleSearch"
          />
          <template #actions>
            <PopoverRoot>
              <PopoverTrigger as-child>
                <Button
                  variant="secondary"
                  size="icon"
                  class="filter-button"
                  :aria-label="$t('g.filter')"
                >
                  <i class="icon-[lucide--list-filter]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                class="ml-[-13px] max-h-(--reka-popover-content-available-height) w-auto max-w-(--reka-popover-content-available-width) overflow-auto rounded-lg border-border/50 p-0 shadow-lg data-[state=open]:animate-none"
                dismiss-on-viewport-change
              >
                <NodeSearchFilter @add-filter="onAddFilter" />
              </PopoverContent>
            </PopoverRoot>
          </template>
        </SidebarTopArea>
        <div class="px-4">
          <div
            v-if="filters?.length"
            class="search-filters flex flex-wrap gap-2 pb-2"
          >
            <SearchFilterChip
              v-for="filter in filters"
              :key="filter.id"
              :text="filter.text"
              :badge="filter.badge"
              :badge-class="filter.badgeClass"
              @remove="onRemoveFilter(filter)"
            />
          </div>
        </div>
      </template>
      <template #body>
        <div>
          <NodeBookmarkTreeExplorer
            ref="nodeBookmarkTreeExplorerRef"
            :filtered-node-defs
            :open-node-help="openNodeHelp"
          />
          <div
            v-show="nodeBookmarkStore.bookmarks.length > 0"
            role="separator"
            class="m-2 border-0 border-t border-dashed"
          />
          <TreeExplorer
            v-model:expanded-keys="expandedKeys"
            data-testid="node-library-tree"
            class="node-lib-tree-explorer"
            :root="renderedRoot"
          >
            <template #node="{ node }">
              <TreeExplorerTreeNode :node>
                <template #before-label>
                  <Badge v-if="node.data?.experimental" severity="primary">
                    {{ $t('g.experimental') }}
                  </Badge>
                  <Badge v-if="node.data?.deprecated" severity="danger">
                    {{ $t('g.deprecated') }}
                  </Badge>
                </template>
                <template v-if="node.data" #actions>
                  <template
                    v-if="subgraphStore.isUserBlueprint(node.data.name)"
                  >
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      :aria-label="$t('g.delete')"
                      @click.stop="
                        void subgraphStore.deleteBlueprint(node.data.name)
                      "
                    >
                      <i class="icon-[lucide--trash-2]" />
                    </Button>
                    <Button
                      variant="muted-textonly"
                      size="icon-sm"
                      :aria-label="$t('g.edit')"
                      @click.stop="
                        void subgraphStore.editBlueprint(node.data.name)
                      "
                    >
                      <i class="icon-[lucide--square-pen]" />
                    </Button>
                  </template>
                  <template v-else>
                    <Button
                      variant="muted-textonly"
                      size="icon-sm"
                      :aria-label="$t('icon.bookmark')"
                      @click.stop="
                        void nodeBookmarkStore.toggleBookmark(node.data)
                      "
                    >
                      <i
                        :class="
                          cn(
                            nodeBookmarkStore.isBookmarked(node.data)
                              ? 'pi pi-bookmark-fill'
                              : 'pi pi-bookmark',
                            'size-3.5'
                          )
                        "
                      />
                    </Button>
                    <Button
                      :tooltip="$t('g.learnMore')"
                      tooltip-side="bottom"
                      variant="muted-textonly"
                      size="icon-sm"
                      :aria-label="$t('g.learnMore')"
                      @click.stop="openNodeHelp(node.data)"
                    >
                      <i class="pi pi-question size-3.5" />
                    </Button>
                  </template>
                </template>
              </TreeExplorerTreeNode>
            </template>
            <template #preview="{ node }">
              <NodePreview v-if="node.data" :node-def="node.data" />
            </template>
          </TreeExplorer>
        </div>
      </template>
    </SidebarTabTemplate>

    <NodeHelpPage v-else :node="currentHelpNode!" @close="closeHelp" />
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import type { Ref } from 'vue'
import {
  computed,
  getCurrentInstance,
  nextTick,
  onMounted,
  onUnmounted,
  ref
} from 'vue'

import SearchFilterChip from '@/components/common/SearchFilterChip.vue'
import type { SearchFilter } from '@/components/common/SearchFilterChip.vue'
import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import TreeExplorer from '@/components/common/TreeExplorer.vue'
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import { renderNodePreview } from '@/components/node/renderNodePreview'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import SidebarTopArea from '@comfyorg/design-system/navigation/SidebarTopArea'
import NodeHelpPage from '@/components/sidebar/tabs/nodeLibrary/NodeHelpPage.vue'
import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import { useTreeExpansion } from '@/composables/useTreeExpansion'
import { useTelemetry } from '@/platform/telemetry'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'
import { useSearchQueryTracking } from '@/platform/telemetry/searchQuery/useSearchQueryTracking'
import { useLitegraphService } from '@/services/litegraphService'
import {
  DEFAULT_GROUPING_ID,
  DEFAULT_SORTING_ID,
  nodeOrganizationService
} from '@/services/nodeOrganizationService'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import type {
  GroupingStrategyId,
  SortingStrategyId
} from '@/types/nodeOrganizationTypes'
import type { TreeExplorerNode, TreeNode } from '@/types/treeExplorerTypes'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
import { cn } from '@comfyorg/tailwind-utils'

import NodeBookmarkTreeExplorer from './nodeLibrary/NodeBookmarkTreeExplorer.vue'

const instance = getCurrentInstance()!
const appContext = instance.appContext
const nodeDefStore = useNodeDefStore()
const nodeBookmarkStore = useNodeBookmarkStore()
const nodeHelpStore = useNodeHelpStore()
const subgraphStore = useSubgraphStore()
const commandStore = useCommandStore()
const expandedKeys = ref<Record<string, boolean>>({})
const { expandNode, toggleNodeOnEvent } = useTreeExpansion(expandedKeys)

const nodeBookmarkTreeExplorerRef = ref<InstanceType<
  typeof NodeBookmarkTreeExplorer
> | null>(null)
const searchBoxRef = ref()

onMounted(() => {
  searchBoxRef.value?.focus()
})

const selectedGroupingId = useLocalStorage<GroupingStrategyId>(
  'Comfy.NodeLibrary.GroupBy',
  DEFAULT_GROUPING_ID
)
const selectedSortingId = useLocalStorage<SortingStrategyId>(
  'Comfy.NodeLibrary.SortBy',
  DEFAULT_SORTING_ID
)

const searchQuery = ref<string>('')

const { currentHelpNode, isHelpOpen } = storeToRefs(nodeHelpStore)
const { openHelp, closeHelp } = nodeHelpStore

onUnmounted(closeHelp)

function openNodeHelp(nodeDef: ComfyNodeDefImpl) {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'node_library_help_button',
    element_group: 'node_library'
  })
  openHelp(nodeDef)
}

const groupingOptions = computed(() =>
  nodeOrganizationService.getGroupingStrategies().map((strategy) => ({
    id: strategy.id,
    label: strategy.label,
    icon: strategy.icon
  }))
)
const sortingOptions = computed(() =>
  nodeOrganizationService.getSortingStrategies().map((strategy) => ({
    id: strategy.id,
    label: strategy.label,
    icon: strategy.icon
  }))
)

const selectedGroupingIcon = computed(() =>
  nodeOrganizationService.getGroupingIcon(selectedGroupingId.value)
)
const selectedSortingIcon = computed(() =>
  nodeOrganizationService.getSortingIcon(selectedSortingId.value)
)

const selectGrouping = (groupingId: string) => {
  selectedGroupingId.value = groupingId as GroupingStrategyId
}
const selectSorting = (sortingId: string) => {
  selectedSortingId.value = sortingId as SortingStrategyId
}

const resetOrganization = () => {
  selectedGroupingId.value = DEFAULT_GROUPING_ID
  selectedSortingId.value = DEFAULT_SORTING_ID
}

const root = computed(() => {
  // Determine which nodes to use
  const nodes =
    filteredNodeDefs.value.length > 0
      ? filteredNodeDefs.value
      : nodeDefStore.visibleNodeDefs

  // Use the service to organize nodes
  return nodeOrganizationService.organizeNodes(nodes, {
    groupBy: selectedGroupingId.value,
    sortBy: selectedSortingId.value
  })
})

const renderedRoot = computed<TreeExplorerNode<ComfyNodeDefImpl>>(() => {
  const fillNodeInfo = (
    node: TreeNode<ComfyNodeDefImpl>
  ): TreeExplorerNode<ComfyNodeDefImpl> => {
    const children = node.children?.map(fillNodeInfo)

    return {
      key: node.key,
      label: node.leaf ? (node.data?.display_name ?? node.label) : node.label,
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
        if (!node.data) return
        return renderNodePreview(container, node.data, appContext)
      },
      handleClick(e: MouseEvent) {
        const nodeDef = this.data
        if (this.leaf && nodeDef) {
          withNodeAddSource('sidebar_drag', () =>
            useLitegraphService().addNodeOnGraph(nodeDef)
          )
        } else {
          toggleNodeOnEvent(e, this)
        }
      },
      ...(node.leaf &&
      node.data &&
      subgraphStore.isUserBlueprint(node.data.name)
        ? {
            async handleDelete() {
              if (this.data) await subgraphStore.deleteBlueprint(this.data.name)
            }
          }
        : {})
    }
  }
  return fillNodeInfo(root.value)
})

const filteredNodeDefs = ref<ComfyNodeDefImpl[]>([])
useSearchQueryTracking('node_sidebar', searchQuery, filteredNodeDefs)
const filters: Ref<
  (SearchFilter & { filter: FuseFilterWithValue<ComfyNodeDefImpl, string> })[]
> = ref([])
const handleSearch = async (query: string) => {
  // Don't apply a min length filter because it does not make sense in
  // multi-byte languages like Chinese, Japanese, Korean, etc.
  if (query.length === 0 && !filters.value.length) {
    filteredNodeDefs.value = []
    expandedKeys.value = {}
    return
  }

  const f = filters.value.map((f) => f.filter)
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

  await nextTick()
  // Expand the search results tree
  if (filteredNodeDefs.value.length > 0) {
    expandNode(root.value)
  }
}

const onAddFilter = async (
  filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => {
  filters.value.push({
    filter: filterAndValue,
    badge: filterAndValue.filterDef.invokeSequence.toUpperCase(),
    badgeClass: filterAndValue.filterDef.invokeSequence + '-badge',
    text: filterAndValue.value,
    id: +new Date()
  })

  await handleSearch(searchQuery.value)
}

const onRemoveFilter = async (
  filterAndValue: SearchFilter & {
    filter: FuseFilterWithValue<ComfyNodeDefImpl, string>
  }
) => {
  const index = filters.value.findIndex((f) => f === filterAndValue)
  if (index !== -1) {
    filters.value.splice(index, 1)
  }
  await handleSearch(searchQuery.value)
}
</script>
