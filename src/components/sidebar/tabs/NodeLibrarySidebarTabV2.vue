<template>
  <SidebarTabTemplate :title="$t('sideToolbar.nodes')">
    <template #header>
      <SidebarTopArea bottom-divider>
        <SearchInput
          ref="searchBoxRef"
          v-model="searchQuery"
          :placeholder="$t('g.search') + '...'"
          @search="handleSearch"
        />
        <template #actions>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <Button
                variant="secondary"
                size="icon"
                :aria-label="$t('g.sort')"
              >
                <i class="icon-[lucide--arrow-up-down] size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                class="z-9999 min-w-32 rounded-lg border border-border-default bg-comfy-menu-bg p-1 shadow-lg"
                align="end"
                :side-offset="4"
              >
                <DropdownMenuRadioGroup v-model="sortOrder">
                  <DropdownMenuRadioItem
                    v-for="option in sortingOptions"
                    :key="option.id"
                    :value="option.id"
                    class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  >
                    <span class="flex-1">{{ $t(option.label) }}</span>
                    <DropdownMenuItemIndicator class="w-4">
                      <i class="icon-[lucide--check] size-4" />
                    </DropdownMenuItemIndicator>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
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
                class="z-9999 w-48 rounded-lg border border-border-default bg-comfy-menu-bg p-1 shadow-lg"
                align="end"
                :side-offset="4"
              >
                <DropdownMenuCheckboxItem
                  v-model="filterOptions.blueprints"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  @select.prevent
                >
                  <span class="flex-1">{{
                    $t('sideToolbar.nodeLibraryTab.filterOptions.blueprints')
                  }}</span>
                  <span class="size-4 shrink-0">
                    <i
                      v-if="filterOptions.blueprints"
                      class="icon-[lucide--check] size-4"
                    />
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  v-model="filterOptions.partnerNodes"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  @select.prevent
                >
                  <span class="flex-1">{{
                    $t('sideToolbar.nodeLibraryTab.filterOptions.partnerNodes')
                  }}</span>
                  <span class="size-4 shrink-0">
                    <i
                      v-if="filterOptions.partnerNodes"
                      class="icon-[lucide--check] size-4"
                    />
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  v-model="filterOptions.comfyNodes"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  @select.prevent
                >
                  <span class="flex-1">{{
                    $t('sideToolbar.nodeLibraryTab.filterOptions.comfyNodes')
                  }}</span>
                  <span class="size-4 shrink-0">
                    <i
                      v-if="filterOptions.comfyNodes"
                      class="icon-[lucide--check] size-4"
                    />
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  v-model="filterOptions.extensions"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  @select.prevent
                >
                  <span class="flex-1">{{
                    $t('sideToolbar.nodeLibraryTab.filterOptions.extensions')
                  }}</span>
                  <span class="size-4 shrink-0">
                    <i
                      v-if="filterOptions.extensions"
                      class="icon-[lucide--check] size-4"
                    />
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator class="m-1 h-px bg-border-subtle" />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  >
                    <span class="flex-1">{{ $t('g.input') }}</span>
                    <div
                      v-if="selectedInputTypes.size > 0"
                      class="flex -space-x-1"
                    >
                      <span
                        v-for="type in selectedInputTypes"
                        :key="type"
                        class="size-3 rounded-full border border-comfy-menu-bg"
                        :style="{ backgroundColor: getSlotColor(type) }"
                      />
                    </div>
                    <i class="icon-[lucide--chevron-right] size-4" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent
                      class="z-9999 flex w-56 flex-col rounded-lg border border-border-default bg-comfy-menu-bg shadow-lg"
                      :side-offset="2"
                      :align-offset="-5"
                    >
                      <div class="px-3 pt-3 pb-1">
                        <div
                          class="flex items-center gap-2 rounded-md border border-border-default bg-comfy-input px-2 py-1"
                        >
                          <i
                            class="icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
                          />
                          <input
                            v-model="inputTypeSearch"
                            type="text"
                            :placeholder="$t('g.search') + '...'"
                            class="w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            @keydown.stop
                          />
                        </div>
                      </div>
                      <div class="max-h-48 overflow-y-auto px-1 pb-1">
                        <DropdownMenuCheckboxItem
                          v-for="type in availableInputTypes"
                          :key="type"
                          :checked="selectedInputTypes.has(type)"
                          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                          @select.prevent="
                            selectedInputTypes = toggleType(
                              selectedInputTypes,
                              type
                            )
                          "
                        >
                          <span
                            :class="
                              cn(
                                'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                                selectedInputTypes.has(type)
                                  ? 'border-primary-background bg-primary-background'
                                  : 'border-border-default'
                              )
                            "
                          >
                            <i
                              v-if="selectedInputTypes.has(type)"
                              class="text-primary-foreground icon-[lucide--check] size-3"
                            />
                          </span>
                          <span class="flex-1 truncate">{{ type }}</span>
                          <span
                            class="size-2.5 shrink-0 rounded-full"
                            :style="{ backgroundColor: getSlotColor(type) }"
                          />
                        </DropdownMenuCheckboxItem>
                      </div>
                      <div
                        v-if="selectedInputTypes.size > 0"
                        class="flex items-center justify-between border-t border-border-subtle px-3 py-1.5 text-xs"
                      >
                        <span class="text-muted-foreground">
                          {{ $t('g.typesSelected', selectedInputTypes.size) }}
                        </span>
                        <Button
                          variant="textonly"
                          size="sm"
                          @click="selectedInputTypes = new Set()"
                        >
                          {{ $t('g.clearAll') }}
                        </Button>
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                  >
                    <span class="flex-1">{{ $t('g.output') }}</span>
                    <div
                      v-if="selectedOutputTypes.size > 0"
                      class="flex -space-x-1"
                    >
                      <span
                        v-for="type in selectedOutputTypes"
                        :key="type"
                        class="size-3 rounded-full border border-comfy-menu-bg"
                        :style="{ backgroundColor: getSlotColor(type) }"
                      />
                    </div>
                    <i class="icon-[lucide--chevron-right] size-4" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent
                      class="z-9999 flex w-56 flex-col rounded-lg border border-border-default bg-comfy-menu-bg shadow-lg"
                      :side-offset="2"
                      :align-offset="-5"
                    >
                      <div class="px-3 pt-3 pb-1">
                        <div
                          class="flex items-center gap-2 rounded-md border border-border-default bg-comfy-input px-2 py-1"
                        >
                          <i
                            class="icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
                          />
                          <input
                            v-model="outputTypeSearch"
                            type="text"
                            :placeholder="$t('g.search') + '...'"
                            class="w-full border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            @keydown.stop
                          />
                        </div>
                      </div>
                      <div class="max-h-48 overflow-y-auto px-1 pb-1">
                        <DropdownMenuCheckboxItem
                          v-for="type in availableOutputTypes"
                          :key="type"
                          :checked="selectedOutputTypes.has(type)"
                          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input"
                          @select.prevent="
                            selectedOutputTypes = toggleType(
                              selectedOutputTypes,
                              type
                            )
                          "
                        >
                          <span
                            :class="
                              cn(
                                'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                                selectedOutputTypes.has(type)
                                  ? 'border-primary-background bg-primary-background'
                                  : 'border-border-default'
                              )
                            "
                          >
                            <i
                              v-if="selectedOutputTypes.has(type)"
                              class="text-primary-foreground icon-[lucide--check] size-3"
                            />
                          </span>
                          <span class="flex-1 truncate">{{ type }}</span>
                          <span
                            class="size-2.5 shrink-0 rounded-full"
                            :style="{ backgroundColor: getSlotColor(type) }"
                          />
                        </DropdownMenuCheckboxItem>
                      </div>
                      <div
                        v-if="selectedOutputTypes.size > 0"
                        class="flex items-center justify-between border-t border-border-subtle px-3 py-1.5 text-xs"
                      >
                        <span class="text-muted-foreground">
                          {{ $t('g.typesSelected', selectedOutputTypes.size) }}
                        </span>
                        <Button
                          variant="textonly"
                          size="sm"
                          @click="selectedOutputTypes = new Set()"
                        >
                          {{ $t('g.clearAll') }}
                        </Button>
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuItem
                  :disabled="
                    selectedInputTypes.size === 0 &&
                    selectedOutputTypes.size === 0
                  "
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-comfy-input data-disabled:cursor-default data-disabled:opacity-50 data-disabled:hover:bg-transparent"
                  @select.prevent="
                    selectedInputTypes = new Set()
                    selectedOutputTypes = new Set()
                  "
                >
                  <span class="flex-1">{{ $t('g.clearTypeFilters') }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </template>
      </SidebarTopArea>
      <div class="border-b border-comfy-input p-2 2xl:px-4">
        <TabList v-model="selectedTab">
          <Tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </Tab>
        </TabList>
      </div>
    </template>
    <template #body>
      <NodeDragPreview />
      <div class="flex h-full flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto py-2">
          <TabPanel
            v-if="flags.nodeLibraryEssentialsEnabled"
            :model-value="selectedTab"
            value="essentials"
          >
            <EssentialNodesPanel
              v-model:expanded-keys="expandedKeys"
              :root="renderedEssentialRoot"
              :flat-nodes="essentialFlatNodes"
              @node-click="handleNodeClick"
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
          <TabPanel :model-value="selectedTab" value="blueprints">
            <BlueprintsPanel
              v-model:expanded-keys="expandedKeys"
              :sections="renderedBlueprintsSections"
              @node-click="handleNodeClick"
            />
          </TabPanel>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  resolveBlueprintSuffix,
  resolveEssentialsDisplayName
} from '@/constants/essentialsDisplayNames'
import { getSlotColor } from '@/constants/slotColors'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import TabPanel from '@/components/tab/TabPanel.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import { usePerTabState } from '@/composables/usePerTabState'
import {
  DEFAULT_SORTING_ID,
  DEFAULT_TAB_ID,
  nodeOrganizationService
} from '@/services/nodeOrganizationService'
import { cn } from '@/utils/tailwindUtil'
import { getProviderIcon } from '@/utils/categoryUtil'
import { flattenTree, sortedTree, unwrapTreeRoot } from '@/utils/treeUtil'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
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
import BlueprintsPanel from './nodeLibrary/BlueprintsPanel.vue'
import EssentialNodesPanel from './nodeLibrary/EssentialNodesPanel.vue'
import NodeDragPreview from './nodeLibrary/NodeDragPreview.vue'
import SidebarTabTemplate from './SidebarTabTemplate.vue'

const { flags } = useFeatureFlags()

const selectedTab = useLocalStorage<TabId>(
  'Comfy.NodeLibrary.Tab',
  DEFAULT_TAB_ID
)

watchEffect(() => {
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

const filterOptions = ref<Record<NodeCategoryId, boolean>>({
  blueprints: true,
  partnerNodes: true,
  comfyNodes: true,
  extensions: true
})

const { t } = useI18n()

const searchBoxRef = ref<InstanceType<typeof SearchInput> | null>(null)
const searchQuery = ref('')

const selectedInputTypes = ref<Set<string>>(new Set())
const selectedOutputTypes = ref<Set<string>>(new Set())
const inputTypeSearch = ref('')
const outputTypeSearch = ref('')

const availableInputTypes = computed(() => {
  const filter = nodeDefStore.nodeSearchService.inputTypeFilter
  const allTypes = filter.fuseSearch.data
  if (!inputTypeSearch.value) return allTypes
  return filter.fuseSearch.search(inputTypeSearch.value)
})

const availableOutputTypes = computed(() => {
  const filter = nodeDefStore.nodeSearchService.outputTypeFilter
  const allTypes = filter.fuseSearch.data
  if (!outputTypeSearch.value) return allTypes
  return filter.fuseSearch.search(outputTypeSearch.value)
})

function toggleType(set: Set<string>, type: string) {
  const next = new Set(set)
  if (next.has(type)) {
    next.delete(type)
  } else {
    next.add(type)
  }
  return next
}

const activeTypeFilters = computed<
  FuseFilterWithValue<ComfyNodeDefImpl, string>[]
>(() => {
  const filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[] = []
  const searchService = nodeDefStore.nodeSearchService
  for (const type of selectedInputTypes.value) {
    filters.push({ filterDef: searchService.inputTypeFilter, value: type })
  }
  for (const type of selectedOutputTypes.value) {
    filters.push({ filterDef: searchService.outputTypeFilter, value: type })
  }
  return filters
})
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
    activeTypeFilters.value,
    { limit: 64 },
    { matchWildcards: false }
  )
})

const activeNodes = computed(() => {
  const base =
    filteredNodeDefs.value.length > 0
      ? filteredNodeDefs.value
      : nodeDefStore.visibleNodeDefs
  if (activeTypeFilters.value.length === 0) return base
  return base.filter((node) =>
    activeTypeFilters.value.every(({ filterDef, value }) =>
      filterDef.matches(node, value)
    )
  )
})

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
  node: TreeNode,
  { useEssentialsLabels = false }: { useEssentialsLabels?: boolean } = {}
): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
  const children = node.children?.map((child) =>
    fillNodeInfo(child, { useEssentialsLabels })
  )
  const totalLeaves = node.leaf
    ? 1
    : (children?.reduce((acc, child) => acc + child.totalLeaves, 0) ?? 0)

  return {
    key: node.key,
    label: node.leaf
      ? useEssentialsLabels
        ? (resolveEssentialsDisplayName(node.data) ?? node.data?.display_name)
        : node.data?.display_name
      : node.label,
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
    (section) => !section.category || filterOptions.value[section.category]
  )
)

const essentialSections = computed(() => {
  if (selectedTab.value !== 'essentials') return []
  return nodeOrganizationService.organizeNodesByTab(
    activeNodes.value,
    'essentials'
  )
})

function disambiguateBlueprintLabels(
  root: RenderedTreeExplorerNode<ComfyNodeDefImpl>
): RenderedTreeExplorerNode<ComfyNodeDefImpl> {
  if (!root.children) return root
  return {
    ...root,
    children: root.children.map((folder) => {
      if (folder.type !== 'folder' || !folder.children) return folder
      const labelCounts = new Map<string, number>()
      for (const node of folder.children) {
        if (node.label)
          labelCounts.set(node.label, (labelCounts.get(node.label) ?? 0) + 1)
      }
      return {
        ...folder,
        children: folder.children.map((node) => {
          if ((labelCounts.get(node.label ?? '') ?? 0) <= 1) return node
          const suffix = resolveBlueprintSuffix(node.data?.name ?? '')
          if (!suffix) return node
          return { ...node, label: `${node.label} (${suffix})` }
        })
      }
    })
  }
}

const renderedEssentialRoot = computed(() => {
  const section = essentialSections.value[0]
  const root = section
    ? fillNodeInfo(applySorting(section.tree), { useEssentialsLabels: true })
    : fillNodeInfo({ key: 'root', label: '', children: [] })
  return disambiguateBlueprintLabels(root)
})

function flattenRenderedLeaves(
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
): RenderedTreeExplorerNode<ComfyNodeDefImpl>[] {
  if (node.type === 'node') return [node]
  return node.children?.flatMap(flattenRenderedLeaves) ?? []
}

const essentialFlatNodes = computed(() => {
  if (sortOrder.value !== 'alphabetical') return []
  return flattenRenderedLeaves(renderedEssentialRoot.value).sort((a, b) =>
    (a.label ?? '').localeCompare(b.label ?? '')
  )
})

const blueprintsSections = computed(() => {
  if (selectedTab.value !== 'blueprints') return []
  return nodeOrganizationService.organizeNodesByTab(
    activeNodes.value,
    'blueprints'
  )
})

const renderedBlueprintsSections = computed(() =>
  renderSections(blueprintsSections.value)
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

  if (filteredNodeDefs.value.length === 0) {
    expandedKeys.value = []
    return
  }

  const allKeys: string[] = []
  if (selectedTab.value === 'essentials') {
    for (const section of essentialSections.value) {
      allKeys.push(...collectFolderKeys(section.tree))
    }
  } else if (selectedTab.value === 'blueprints') {
    for (const section of blueprintsSections.value) {
      allKeys.push(...collectFolderKeys(section.tree))
    }
  } else {
    for (const section of sections.value) {
      allKeys.push(...collectFolderKeys(section.tree))
    }
  }
  expandedKeys.value = allKeys
}

const tabs = computed(() => {
  const allTabs: Array<{ value: TabId; label: string }> = [
    { value: 'all', label: t('sideToolbar.nodeLibraryTab.allNodes') },
    {
      value: 'essentials' as TabId,
      label: t('sideToolbar.nodeLibraryTab.essentials')
    },
    {
      value: 'blueprints',
      label: t('sideToolbar.nodeLibraryTab.blueprints')
    }
  ]
  return flags.nodeLibraryEssentialsEnabled ? allTabs : [allTabs[0], allTabs[2]]
})

onMounted(() => {
  searchBoxRef.value?.focus()
})
</script>
