<template>
  <SidebarTabTemplate hide-toolbar :title="$t('sideToolbar.nodes')">
    <template #body>
      <div class="flex h-full flex-col">
        <div class="shrink-0 overflow-hidden bg-comfy-menu-bg">
          <div
            ref="titleTabsRef"
            class="transition-[margin-top] duration-200 ease-out"
            :style="{ marginTop: `${headerTop}px` }"
          >
            <div class="px-4 pt-4 pb-2 font-bold">
              {{ $t('sideToolbar.nodes') }}
            </div>
            <div class="px-4 pt-2 pb-0">
              <TabList v-model="selectedTab">
                <Tab v-for="{ value, label } in tabs" :key="value" :value>
                  {{ label }}
                </Tab>
              </TabList>
            </div>
          </div>
          <div class="border-b border-border-default bg-comfy-menu-bg py-2">
            <div class="flex items-center gap-2 px-4 py-2">
              <div class="min-w-0 flex-1">
                <SearchInput
                  ref="searchBoxRef"
                  v-model="searchQuery"
                  :placeholder="$t('g.search') + '...'"
                  @search="handleSearch"
                />
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <FilterDropdown
                  v-if="selectedTab === 'essentials'"
                  v-model="essentialsFilters"
                  :filter-labels="essentialsFilterLabels"
                />
                <FilterDropdown
                  v-else
                  v-model="nodeFilters"
                  :filter-labels="nodeFilterLabels"
                />
                <DropdownMenu
                  v-if="selectedTab === 'essentials'"
                  :entries="jumpMenuEntries"
                >
                  <template #button>
                    <Button size="icon" :aria-label="$t('essentials.jumpTo')">
                      <i class="icon-[lucide--list-tree] size-4" />
                    </Button>
                  </template>
                </DropdownMenu>
                <DropdownMenu v-else>
                  <template #button>
                    <Button size="icon" :aria-label="$t('g.sort')">
                      <i class="icon-[lucide--settings-2] size-4" />
                    </Button>
                  </template>
                  <template #default="{ itemClass }">
                    <DropdownMenuRadioGroup v-model="sortOrder">
                      <DropdownMenuRadioItem
                        v-for="option in sortingOptions"
                        :key="option.id"
                        :value="option.id"
                        :class="itemClass"
                      >
                        <span class="flex-1">{{ $t(option.label) }}</span>
                        <DropdownMenuItemIndicator class="size-4 shrink-0">
                          <i class="icon-[lucide--check]" />
                        </DropdownMenuItemIndicator>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </template>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        <div
          ref="scrollContainerRef"
          class="min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto overscroll-none pb-2"
        >
          <TabPanel
            v-if="flags.nodeLibraryEssentialsEnabled"
            :model-value="selectedTab"
            value="essentials"
          >
            <EssentialNodesPanel
              :media-filters="essentialsFilters"
              :search-query
            />
          </TabPanel>
          <TabPanel :model-value="selectedTab" value="all">
            <div
              v-if="hasNoMatches"
              class="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground"
            >
              {{
                $t('sideToolbar.nodeLibraryTab.noMatchingNodes', {
                  query: searchQuery
                })
              }}
            </div>
            <AllNodesPanel
              v-else
              v-model:expanded-keys="expandedKeys"
              :sections="renderedSections"
              :fill-node-info="fillNodeInfo"
              :sort-order="sortOrder"
              @node-click="handleNodeClick"
            />
          </TabPanel>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { useEventListener, useLocalStorage } from '@vueuse/core'
import { mapValues } from 'es-toolkit'
import type { MenuItem } from 'primevue/menuitem'
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from 'reka-ui'
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useTemplateRef,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import FilterDropdown from '@/components/common/FilterDropdown.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import TabPanel from '@/components/tab/TabPanel.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import { usePerTabState } from '@/composables/usePerTabState'
import { ESSENTIAL_SECTIONS } from '@/constants/essentialsNodes'
import { useSearchQueryTracking } from '@/platform/telemetry/searchQuery/useSearchQueryTracking'
import {
  DEFAULT_SORTING_ID,
  DEFAULT_TAB_ID,
  nodeOrganizationService
} from '@/services/nodeOrganizationService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { buildNodeDefTree, useNodeDefStore } from '@/stores/nodeDefStore'
import type {
  NodeCategoryId,
  NodeSection,
  SortingStrategyId,
  TabId
} from '@/types/nodeOrganizationTypes'
import type {
  NodeLibrarySection,
  RenderedTreeExplorerNode,
  TreeNode
} from '@/types/treeExplorerTypes'
import { getProviderIcon } from '@/utils/categoryUtil'
import { flattenTree, sortedTree, unwrapTreeRoot } from '@/utils/treeUtil'

import AllNodesPanel from './nodeLibrary/AllNodesPanel.vue'
import EssentialNodesPanel from './nodeLibrary/EssentialNodesPanel.vue'
import SidebarTabTemplate from './SidebarTabTemplate.vue'

const { flags } = useFeatureFlags()

const scrollContainerRef = useTemplateRef('scrollContainerRef')
const titleTabsRef = useTemplateRef('titleTabsRef')
const headerTop = ref(0)
let lastScrollY = 0

useEventListener(scrollContainerRef, 'scroll', () => {
  const el = scrollContainerRef.value
  if (!el) return
  const y = el.scrollTop
  const h = titleTabsRef.value?.offsetHeight ?? 0
  const delta = y - lastScrollY
  if (y <= 0) {
    headerTop.value = 0
  } else if (delta > 0) {
    headerTop.value = Math.max(-h, headerTop.value - delta)
  } else if (delta < 0) {
    headerTop.value = Math.min(0, headerTop.value - delta)
  }
  lastScrollY = y
})

const selectedTab = useLocalStorage<TabId>(
  'Comfy.NodeLibrary.Tab',
  DEFAULT_TAB_ID
)

watchEffect(() => {
  if (selectedTab.value === 'blueprints') selectedTab.value = DEFAULT_TAB_ID
  if (
    !flags.nodeLibraryEssentialsEnabled &&
    selectedTab.value === 'essentials'
  ) {
    selectedTab.value = DEFAULT_TAB_ID
  }
})

const sortOrderByTab = useLocalStorage<Record<TabId, SortingStrategyId>>(
  'Comfy.NodeLibrary.SortByTab',
  {
    essentials: DEFAULT_SORTING_ID,
    all: DEFAULT_SORTING_ID,
    blueprints: 'alphabetical'
  }
)
const sortOrder = usePerTabState(selectedTab, sortOrderByTab)

const sortingOptions = computed(() =>
  nodeOrganizationService.getSortingStrategies().map((strategy) => ({
    id: strategy.id,
    label: strategy.label
  }))
)

const nodeFilterLabels: Record<NodeCategoryId, string> = {
  blueprints: 'sideToolbar.nodeLibraryTab.filterOptions.blueprints',
  comfyNodes: 'sideToolbar.nodeLibraryTab.filterOptions.comfyNodes',
  partnerNodes: 'sideToolbar.nodeLibraryTab.filterOptions.partnerNodes',
  extensions: 'sideToolbar.nodeLibraryTab.filterOptions.extensions'
} as const
const nodeFilters = ref(mapValues(nodeFilterLabels, () => true))
const essentialsFilterLabels = {
  image: 'sideToolbar.mediaAssets.filterImage',
  video: 'sideToolbar.mediaAssets.filterVideo',
  text: 'sideToolbar.mediaAssets.filterText',
  audio: 'sideToolbar.mediaAssets.filterAudio',
  '3d': 'sideToolbar.mediaAssets.filter3D'
} as const
const essentialsFilters = ref(mapValues(essentialsFilterLabels, () => true))

const { t } = useI18n()

const searchBoxRef = useTemplateRef('searchBoxRef')
const searchQuery = ref('')
const expandedKeysByTab = ref<Record<TabId, string[]>>({
  essentials: [],
  all: [],
  blueprints: []
})
const expandedKeys = usePerTabState(selectedTab, expandedKeysByTab)

const nodeDefStore = useNodeDefStore()
const { startDrag } = useNodeDragToCanvas()

const filteredNodeDefs = computed(() => {
  if (searchQuery.value.length === 0) {
    return []
  }
  return nodeDefStore.nodeSearchService.searchNode(
    searchQuery.value,
    [],
    { limit: 64 },
    { matchWildcards: false }
  )
})

const activeNodes = computed(() =>
  searchQuery.value.length === 0
    ? nodeDefStore.visibleNodeDefs
    : filteredNodeDefs.value
)

useSearchQueryTracking('node_sidebar', searchQuery, filteredNodeDefs)

const hasNoMatches = computed(
  () => searchQuery.value.length > 0 && filteredNodeDefs.value.length === 0
)

const sections = computed(() => {
  return nodeOrganizationService.organizeNodesTab(activeNodes.value)
})

function getFolderIcon(node: TreeNode): string {
  const firstLeaf = findFirstLeaf(node)
  if (
    firstLeaf?.data?.api_node &&
    firstLeaf.key?.replace(`${node.key}/`, '') === firstLeaf.label
  ) {
    return getProviderIcon(node.label ?? '')
  }
  return 'icon-[lucide--folder]'
}

function findFirstLeaf(node: TreeNode): TreeNode | undefined {
  if (node.leaf) return node
  for (const child of node.children ?? []) {
    const leaf = findFirstLeaf(child)
    if (leaf) return leaf
  }
  return undefined
}

function fillNodeInfo(
  node: TreeNode
): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
  const children = node.children?.map(fillNodeInfo)
  const totalLeaves = node.leaf
    ? 1
    : (children?.reduce((acc, child) => acc + child.totalLeaves, 0) ?? 0)

  return {
    key: node.key,
    label: node.leaf ? node.data?.display_name : node.label,
    leaf: node.leaf,
    data: node.data,
    icon: node.leaf ? 'icon-[comfy--node]' : getFolderIcon(node),
    type: node.leaf ? 'node' : 'folder',
    totalLeaves,
    children
  }
}

function applySorting(tree: TreeNode): TreeNode {
  if (sortOrder.value === 'alphabetical') {
    return sortedTree(tree, { groupLeaf: true })
  }
  return tree
}

function renderSections(
  nodeSections: NodeSection[],
  filter?: (section: NodeSection) => boolean
): NodeLibrarySection<ComfyNodeDefImpl>[] {
  const filtered = filter ? nodeSections.filter(filter) : nodeSections

  if (sortOrder.value === 'alphabetical') {
    const allNodes = filtered.flatMap((section) =>
      flattenTree<ComfyNodeDefImpl>(section.tree)
    )
    const mergedTree = unwrapTreeRoot(buildNodeDefTree(allNodes))
    return [{ root: fillNodeInfo(applySorting(mergedTree)) }]
  }

  return filtered.map((section) => ({
    category: section.category,
    title: section.title,
    root: fillNodeInfo(applySorting(section.tree))
  }))
}

const renderedSections = computed(() =>
  renderSections(
    sections.value,
    (section) => !section.category || nodeFilters.value[section.category]
  )
)

function collectFolderKeys(node: TreeNode): string[] {
  if (node.leaf) return []
  const keys = [node.key]
  for (const child of node.children ?? []) {
    keys.push(...collectFolderKeys(child))
  }
  return keys
}

function handleNodeClick(node: RenderedTreeExplorerNode<ComfyNodeDefImpl>) {
  if (node.type === 'node' && node.data) {
    startDrag(node.data)
  }
  if (node.type === 'folder') {
    const index = expandedKeys.value.indexOf(node.key)
    if (index === -1) {
      expandedKeys.value = [...expandedKeys.value, node.key]
    } else {
      expandedKeys.value = expandedKeys.value.filter((k) => k !== node.key)
    }
  }
}

async function handleSearch() {
  await nextTick()

  if (selectedTab.value === 'essentials') return

  if (filteredNodeDefs.value.length === 0) {
    expandedKeys.value = []
    return
  }

  const allKeys: string[] = []
  for (const section of sections.value) {
    allKeys.push(...collectFolderKeys(section.tree))
  }
  expandedKeys.value = allKeys
}

function smoothScrollTo(
  container: HTMLElement,
  target: number,
  duration = 300
) {
  const start = container.scrollTop
  const distance = target - start
  if (Math.abs(distance) < 1) return
  const startTime = performance.now()
  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    container.scrollTop = start + distance * eased
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

async function scrollToId(id: string, marginTop = 0) {
  await nextTick()
  const container = scrollContainerRef.value
  const el = document.getElementById(id)
  if (!container || !el) return
  const top =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    marginTop
  smoothScrollTo(container, top)
}

const STICKY_SECTION_HEADER_HEIGHT = 56
async function jumpToSection(sectionKey: string) {
  await scrollToId(`essentials-section-${sectionKey}`)
}

async function jumpToSubgroup(subgroupKey: string) {
  await scrollToId(
    `essentials-subgroup-${subgroupKey}`,
    STICKY_SECTION_HEADER_HEIGHT
  )
}

const jumpMenuEntries = computed<MenuItem[]>(() => {
  const entries = ESSENTIAL_SECTIONS.map((section) => {
    if (!section.subgroups)
      return {
        label: t(`essentials.${section.key}`),
        command: () => jumpToSection(section.key),
        noIcon: true
      }

    const items = section.subgroups.map((subgroup) => ({
      label: t(`essentials.${subgroup.key}`),
      command: () => jumpToSubgroup(subgroup.key),
      noIcon: true
    }))
    return { label: t(`essentials.${section.key}`), items }
  })
  const label = t('essentials.jumpTo').toUpperCase()
  return [{ label, noIcon: true }, ...entries]
})

const tabs = computed<Array<{ value: TabId; label: string }>>(() => {
  const allNodesTab = {
    value: 'all',
    label: t('sideToolbar.nodeLibraryTab.allNodes')
  } as const
  if (!flags.nodeLibraryEssentialsEnabled) return [allNodesTab]
  return [
    {
      value: 'essentials',
      label: t('sideToolbar.nodeLibraryTab.essentials')
    },
    allNodesTab
  ]
})

onMounted(() => {
  searchBoxRef.value?.focus()
})
</script>
