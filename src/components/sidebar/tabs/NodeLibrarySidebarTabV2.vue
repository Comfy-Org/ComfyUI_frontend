<template>
  <SidebarTabTemplate hide-toolbar :title="$t('sideToolbar.nodes')">
    <template #body>
      <NodeDragPreview />
      <div class="flex h-full flex-col">
        <div
          class="min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto overscroll-none"
        >
          <div class="px-4 pt-4 pb-2 font-bold">
            {{ $t('sideToolbar.nodes') }}
          </div>
          <div class="px-4 pt-2 pb-0">
            <TabList v-model="selectedTab">
              <Tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
                {{ tab.label }}
              </Tab>
            </TabList>
          </div>
          <div
            class="sticky top-0 z-20 border-b border-border-default bg-comfy-menu-bg py-2"
          >
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
                <DropdownMenuRoot v-if="selectedTab === 'all'">
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="secondary"
                      size="icon"
                      :aria-label="$t('sideToolbar.nodeLibraryTab.filter')"
                    >
                      <i class="icon-[lucide--list-filter] size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent
                      class="z-9999 min-w-32 rounded-lg border border-border-default bg-comfy-menu-bg p-1 shadow-lg"
                      align="end"
                      :side-offset="4"
                    >
                      <DropdownMenuCheckboxItem
                        :model-value="allCategoriesSelected"
                        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                        @select.prevent
                        @update:model-value="selectAllCategories"
                      >
                        <span class="flex-1">{{ $t('g.all') }}</span>
                        <span class="size-4 shrink-0">
                          <DropdownMenuItemIndicator>
                            <i class="icon-[lucide--check] size-4" />
                          </DropdownMenuItemIndicator>
                        </span>
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        v-for="category in filterableCategories"
                        :key="category"
                        :model-value="filterOptions[category]"
                        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                        @select.prevent
                        @update:model-value="
                          setCategoryFilter(category, $event)
                        "
                      >
                        <span class="flex-1">{{
                          $t(
                            `sideToolbar.nodeLibraryTab.filterOptions.${category}`
                          )
                        }}</span>
                        <span class="size-4 shrink-0">
                          <DropdownMenuItemIndicator>
                            <i class="icon-[lucide--check] size-4" />
                          </DropdownMenuItemIndicator>
                        </span>
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenuRoot>
                <DropdownMenuRoot>
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="secondary"
                      size="icon"
                      :aria-label="
                        selectedTab === 'essentials'
                          ? $t('sideToolbar.nodeLibraryTab.filter')
                          : $t('g.sort')
                      "
                    >
                      <i
                        :class="
                          cn(
                            'size-4',
                            selectedTab === 'essentials'
                              ? 'icon-[lucide--list-filter]'
                              : 'icon-[lucide--settings-2]'
                          )
                        "
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent
                      class="z-9999 min-w-32 rounded-lg border border-border-default bg-comfy-menu-bg p-1 shadow-lg"
                      align="end"
                      :side-offset="4"
                    >
                      <DropdownMenuRadioGroup
                        v-if="selectedTab !== 'essentials'"
                        v-model="sortOrder"
                      >
                        <DropdownMenuRadioItem
                          v-for="option in sortingOptions"
                          :key="option.id"
                          :value="option.id"
                          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                        >
                          <span class="flex-1">{{ $t(option.label) }}</span>
                          <span class="size-4 shrink-0">
                            <DropdownMenuItemIndicator>
                              <i class="icon-[lucide--check] size-4" />
                            </DropdownMenuItemIndicator>
                          </span>
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <template v-if="selectedTab === 'essentials'">
                        <DropdownMenuCheckboxItem
                          :model-value="allMediaSelected"
                          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                          @select.prevent
                          @update:model-value="selectAllMedia"
                        >
                          <span class="flex-1">{{ $t('g.all') }}</span>
                          <span class="size-4 shrink-0">
                            <DropdownMenuItemIndicator>
                              <i class="icon-[lucide--check] size-4" />
                            </DropdownMenuItemIndicator>
                          </span>
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          v-for="media in ESSENTIALS_MEDIA_TYPES"
                          :key="media"
                          :model-value="mediaFilters[media]"
                          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                          @select.prevent
                          @update:model-value="setMediaFilter(media, $event)"
                        >
                          <span class="flex-1">
                            {{ ESSENTIALS_MEDIA_LABELS[media] }}
                          </span>
                          <span class="size-4 shrink-0">
                            <DropdownMenuItemIndicator>
                              <i class="icon-[lucide--check] size-4" />
                            </DropdownMenuItemIndicator>
                          </span>
                        </DropdownMenuCheckboxItem>
                      </template>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenuRoot>
                <DropdownMenuRoot v-if="selectedTab === 'essentials'">
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="secondary"
                      size="icon"
                      :aria-label="$t('essentials.jumpTo')"
                    >
                      <i class="icon-[lucide--list-tree] size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent
                      class="z-9999 flex min-w-44 flex-col gap-1 rounded-lg border border-border-default bg-comfy-menu-bg p-1 shadow-lg"
                      align="start"
                      :side-offset="4"
                    >
                      <DropdownMenuLabel
                        class="px-2 py-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        {{ $t('essentials.jumpTo') }}
                      </DropdownMenuLabel>
                      <template
                        v-for="section in ESSENTIAL_PLACEHOLDER_SECTIONS"
                        :key="section.key"
                      >
                        <DropdownMenuSub v-if="section.subgroups">
                          <DropdownMenuSubTrigger
                            class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input data-[state=open]:bg-comfy-input"
                          >
                            <span class="flex-1">{{ section.label }}</span>
                            <i
                              class="icon-[lucide--chevron-right] size-4 text-muted-foreground"
                            />
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent
                              class="z-9999 flex min-w-44 flex-col gap-1 rounded-lg border border-border-default bg-comfy-menu-bg p-1 shadow-lg"
                              :side-offset="8"
                            >
                              <DropdownMenuItem
                                v-for="subgroup in section.subgroups"
                                :key="subgroup.key"
                                class="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                                @select="
                                  jumpToSubgroup(section.key, subgroup.key)
                                "
                              >
                                {{ subgroup.label }}
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuItem
                          v-else
                          class="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                          @select="jumpToSection(section.key)"
                        >
                          {{ section.label }}
                        </DropdownMenuItem>
                      </template>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenuRoot>
              </div>
            </div>
          </div>
          <div class="pb-2">
            <TabPanel
              v-if="flags.nodeLibraryEssentialsEnabled"
              :model-value="selectedTab"
              value="essentials"
            >
              <EssentialNodesPlaceholderPanel
                v-model:expanded-keys="expandedKeys"
                :search-query="searchQuery"
              />
            </TabPanel>
            <TabPanel :model-value="selectedTab" value="all">
              <AllNodesPanel
                v-model:expanded-keys="expandedKeys"
                :sections="renderedSections"
                :fill-node-info="fillNodeInfo"
                :sort-order="sortOrder"
                @node-click="handleNodeClick"
              />
            </TabPanel>
          </div>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useLocalStorage } from '@vueuse/core'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import TabPanel from '@/components/tab/TabPanel.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  ESSENTIALS_MEDIA_LABELS,
  ESSENTIALS_MEDIA_TYPES,
  useEssentialsFilters
} from '@/composables/useEssentialsFilters'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import { usePerTabState } from '@/composables/usePerTabState'
import { ESSENTIAL_PLACEHOLDER_SECTIONS } from '@/constants/essentialsPlaceholders'
import {
  DEFAULT_SORTING_ID,
  DEFAULT_TAB_ID,
  nodeOrganizationService
} from '@/services/nodeOrganizationService'
import { getProviderIcon } from '@/utils/categoryUtil'
import { flattenTree, sortedTree, unwrapTreeRoot } from '@/utils/treeUtil'
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

import AllNodesPanel from './nodeLibrary/AllNodesPanel.vue'
import EssentialNodesPlaceholderPanel from './nodeLibrary/EssentialNodesPlaceholderPanel.vue'
import NodeDragPreview from './nodeLibrary/NodeDragPreview.vue'
import SidebarTabTemplate from './SidebarTabTemplate.vue'

const { flags } = useFeatureFlags()
const { mediaFilters, setMediaFilter, allMediaSelected, selectAllMedia } =
  useEssentialsFilters()

const selectedTab = useLocalStorage<TabId>(
  'Comfy.NodeLibrary.Tab',
  DEFAULT_TAB_ID
)

watchEffect(() => {
  if (selectedTab.value === 'blueprints') {
    selectedTab.value = DEFAULT_TAB_ID
    return
  }
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

const filterableCategories: NodeCategoryId[] = [
  'blueprints',
  'essentialNodes',
  'comfyNodes',
  'partnerNodes',
  'extensions'
]

const filterOptions = ref<Record<NodeCategoryId, boolean>>({
  blueprints: false,
  essentialNodes: false,
  comfyNodes: false,
  partnerNodes: false,
  extensions: false
})

const allCategoriesSelected = ref(true)

function clearAllCategoryFilters() {
  for (const category of filterableCategories) {
    filterOptions.value[category] = false
  }
}

function selectAllCategories() {
  clearAllCategoryFilters()
  allCategoriesSelected.value = true
}

function setCategoryFilter(category: NodeCategoryId, enabled: boolean) {
  if (allCategoriesSelected.value) {
    clearAllCategoryFilters()
    allCategoriesSelected.value = false
  }
  filterOptions.value[category] = enabled
  const allChecked = filterableCategories.every((c) => filterOptions.value[c])
  const anyChecked = filterableCategories.some((c) => filterOptions.value[c])
  if (allChecked || !anyChecked) {
    selectAllCategories()
  }
}

const effectiveFilterOptions = computed<Record<NodeCategoryId, boolean>>(() => {
  if (allCategoriesSelected.value) {
    return filterableCategories.reduce(
      (acc, c) => ({ ...acc, [c]: true }),
      {} as Record<NodeCategoryId, boolean>
    )
  }
  return filterOptions.value
})

const { t } = useI18n()

const searchBoxRef = ref<InstanceType<typeof SearchInput> | null>(null)
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
  filteredNodeDefs.value.length > 0
    ? filteredNodeDefs.value
    : nodeDefStore.visibleNodeDefs
)

const sections = computed(() => {
  if (selectedTab.value !== 'all') return []
  return nodeOrganizationService.organizeNodesByTab(activeNodes.value, 'all')
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
    (section) =>
      !section.category || effectiveFilterOptions.value[section.category]
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

function findScrollableAncestor(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const style = getComputedStyle(node)
    const overflowY = style.overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
    node = node.parentElement
  }
  return document.scrollingElement as HTMLElement
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

async function scrollToId(id: string, marginTop: number) {
  await nextTick()
  const el = document.getElementById(id)
  if (!el) return
  const container = findScrollableAncestor(el)
  const top =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    marginTop
  smoothScrollTo(container, top)
}

function ensureExpanded(sectionKey: string) {
  if (!expandedKeys.value.includes(sectionKey)) {
    expandedKeys.value = [...expandedKeys.value, sectionKey]
  }
}

const STICKY_SEARCH_HEIGHT = 65
const STICKY_SECTION_HEADER_HEIGHT = 56

async function jumpToSection(sectionKey: string) {
  ensureExpanded(sectionKey)
  await scrollToId(`essentials-section-${sectionKey}`, STICKY_SEARCH_HEIGHT)
}

async function jumpToSubgroup(sectionKey: string, subgroupKey: string) {
  ensureExpanded(sectionKey)
  await scrollToId(
    `essentials-subgroup-${subgroupKey}`,
    STICKY_SEARCH_HEIGHT + STICKY_SECTION_HEADER_HEIGHT
  )
}

const tabs = computed<Array<{ value: TabId; label: string }>>(() => {
  const allNodesTab = {
    value: 'all' as TabId,
    label: t('sideToolbar.nodeLibraryTab.allNodes')
  }
  if (!flags.nodeLibraryEssentialsEnabled) return [allNodesTab]
  return [
    {
      value: 'essentials' as TabId,
      label: t('sideToolbar.nodeLibraryTab.essentials')
    },
    allNodesTab
  ]
})

onMounted(() => {
  searchBoxRef.value?.focus()
})
</script>
