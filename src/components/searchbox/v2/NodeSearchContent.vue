<template>
  <FocusScope as-child loop>
    <div
      ref="dialogRef"
      class="flex h-[min(80vh,750px)] w-full flex-col overflow-hidden rounded-lg border border-interface-stroke bg-base-background"
    >
      <!-- Search input row -->
      <NodeSearchInput
        ref="searchInputRef"
        v-model:search-query="searchQuery"
        :filters="filters"
        @remove-filter="emit('removeFilter', $event)"
        @navigate-down="navigateResults(1)"
        @navigate-up="navigateResults(-1)"
        @select-current="selectCurrentResult"
      />

      <!-- Filter header row -->
      <div class="flex items-center">
        <NodeSearchFilterBar
          class="flex-1"
          :filters="filters"
          :active-category="rootFilter"
          :has-favorites="nodeBookmarkStore.bookmarks.length > 0"
          :has-essential-nodes="nodeAvailability.essential"
          :has-blueprint-nodes="nodeAvailability.blueprint"
          :has-partner-nodes="nodeAvailability.partner"
          :has-custom-nodes="nodeAvailability.custom"
          @toggle-filter="onToggleFilter"
          @clear-filter-group="onClearFilterGroup"
          @focus-search="nextTick(() => searchInputRef?.focus())"
          @select-category="onSelectCategory"
        />
      </div>

      <!-- Content area -->
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- Category sidebar -->
        <NodeSearchCategorySidebar
          v-model:selected-category="sidebarCategory"
          class="w-52 shrink-0"
          :hide-chevrons="!anyTreeCategoryHasChildren"
          :hide-presets="rootFilter !== null"
          :node-defs="rootFilteredNodeDefs"
          :root-label="rootFilterLabel"
          :root-key="rootFilter ?? undefined"
          @auto-expand="selectedCategory = $event"
        />

        <!-- Results list -->
        <div
          id="results-list"
          role="listbox"
          tabindex="-1"
          class="flex-1 overflow-y-auto py-2 pr-3 pl-1 select-none"
          @pointermove="onPointerMove"
        >
          <div
            v-for="(node, index) in displayedResults"
            :id="`result-item-${index}`"
            :key="node.name"
            role="option"
            data-testid="result-item"
            :tabindex="index === selectedIndex ? 0 : -1"
            :aria-selected="index === selectedIndex"
            :class="
              cn(
                'flex h-14 cursor-pointer items-center rounded-lg px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary',
                index === selectedIndex && 'bg-secondary-background'
              )
            "
            @click="emit('addNode', node, $event)"
            @keydown.down.prevent="navigateResults(1, true)"
            @keydown.up.prevent="navigateResults(-1, true)"
            @keydown.enter.prevent="selectCurrentResult"
          >
            <NodeSearchListItem
              :node-def="node"
              :current-query="searchQuery"
              show-description
              :show-source-badge="rootFilter !== 'essentials'"
              :hide-bookmark-icon="selectedCategory === 'favorites'"
            />
          </div>
          <div
            v-if="displayedResults.length === 0"
            class="px-4 py-8 text-center text-muted-foreground"
          >
            {{ $t('g.noResults') }}
          </div>
        </div>
      </div>
    </div>
  </FocusScope>
</template>

<script setup lang="ts">
import { FocusScope } from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import NodeSearchCategorySidebar, {
  DEFAULT_CATEGORY
} from '@/components/searchbox/v2/NodeSearchCategorySidebar.vue'
import NodeSearchInput from '@/components/searchbox/v2/NodeSearchInput.vue'
import NodeSearchListItem from '@/components/searchbox/v2/NodeSearchListItem.vue'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  BLUEPRINT_CATEGORY,
  isCustomNode,
  isEssentialNode
} from '@/types/nodeSource'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'
import { cn } from '@/utils/tailwindUtil'

const sourceCategoryFilters: Record<string, (n: ComfyNodeDefImpl) => boolean> =
  {
    essentials: isEssentialNode,
    comfy: (n) => !isCustomNode(n),
    custom: isCustomNode
  }

const { filters } = defineProps<{
  filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
}>()

const emit = defineEmits<{
  addNode: [nodeDef: ComfyNodeDefImpl, dragEvent?: MouseEvent]
  addFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  removeFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  hoverNode: [nodeDef: ComfyNodeDefImpl | null]
}>()

const { t } = useI18n()
const { flags } = useFeatureFlags()
const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()
const nodeBookmarkStore = useNodeBookmarkStore()

const nodeAvailability = computed(() => {
  let essential = false
  let blueprint = false
  let partner = false
  let custom = false
  for (const n of nodeDefStore.visibleNodeDefs) {
    if (!essential && flags.nodeLibraryEssentialsEnabled && isEssentialNode(n))
      essential = true
    if (!blueprint && n.category.startsWith(BLUEPRINT_CATEGORY))
      blueprint = true
    if (!partner && n.api_node) partner = true
    if (!custom && isCustomNode(n)) custom = true
    if (essential && blueprint && partner && custom) break
  }
  return { essential, blueprint, partner, custom }
})

const dialogRef = ref<HTMLElement>()
const searchInputRef = ref<InstanceType<typeof NodeSearchInput>>()

const searchQuery = ref('')
const selectedCategory = ref(DEFAULT_CATEGORY)
const selectedIndex = ref(0)

// Root filter from filter bar category buttons (radio toggle)
const rootFilter = ref<string | null>(null)

const rootFilterLabel = computed(() => {
  switch (rootFilter.value) {
    case 'favorites':
      return t('g.bookmarked')
    case BLUEPRINT_CATEGORY:
      return t('g.blueprints')
    case 'partner-nodes':
      return t('g.partner')
    case 'essentials':
      return t('g.essentials')
    case 'comfy':
      return t('g.comfy')
    case 'custom':
      return t('g.extensions')
    default:
      return undefined
  }
})

const rootFilteredNodeDefs = computed(() => {
  if (!rootFilter.value) return nodeDefStore.visibleNodeDefs
  const allNodes = nodeDefStore.visibleNodeDefs
  const sourceFilter = sourceCategoryFilters[rootFilter.value]
  if (sourceFilter) return allNodes.filter(sourceFilter)
  switch (rootFilter.value) {
    case 'favorites':
      return allNodes.filter((n) => nodeBookmarkStore.isBookmarked(n))
    case BLUEPRINT_CATEGORY:
      return allNodes.filter((n) => n.category.startsWith(rootFilter.value!))
    case 'partner-nodes':
      return allNodes.filter((n) => n.api_node)
    default:
      return allNodes
  }
})

function onToggleFilter(
  filterDef: FuseFilter<ComfyNodeDefImpl, string>,
  value: string
) {
  const existing = filters.find(
    (f) => f.filterDef.id === filterDef.id && f.value === value
  )
  if (existing) {
    emit('removeFilter', existing)
  } else {
    emit('addFilter', { filterDef, value })
  }
}

function onClearFilterGroup(filterId: string) {
  for (const f of filters.filter((f) => f.filterDef.id === filterId)) {
    emit('removeFilter', f)
  }
}

function onSelectCategory(category: string) {
  if (rootFilter.value === category) {
    rootFilter.value = null
  } else {
    rootFilter.value = category
  }
  selectedCategory.value = DEFAULT_CATEGORY
  nextTick(() => searchInputRef.value?.focus())
}

const searchResults = computed(() => {
  if (!searchQuery.value && filters.length === 0) {
    return nodeFrequencyStore.topNodeDefs
  }
  return nodeDefStore.nodeSearchService.searchNode(searchQuery.value, filters, {
    limit: 64
  })
})

const sidebarCategory = computed({
  get: () => selectedCategory.value,
  set: (category: string) => {
    selectedCategory.value = category
  }
})

// Check if any tree category has children (for chevron visibility)
const anyTreeCategoryHasChildren = computed(() =>
  rootFilteredNodeDefs.value.some((n) => n.category.includes('/'))
)

function getMostRelevantResults(baseNodes: ComfyNodeDefImpl[]) {
  if (searchQuery.value || filters.length > 0) {
    const searched = searchResults.value
    if (!rootFilter.value) return searched
    const rootSet = new Set(baseNodes.map((n) => n.name))
    return searched.filter((n) => rootSet.has(n.name))
  }
  return rootFilter.value ? baseNodes : nodeFrequencyStore.topNodeDefs
}

function getCategoryResults(baseNodes: ComfyNodeDefImpl[], category: string) {
  if (rootFilter.value && category === rootFilter.value) return baseNodes
  const rootPrefix = rootFilter.value ? rootFilter.value + '/' : ''
  const categoryPath = category.startsWith(rootPrefix)
    ? category.slice(rootPrefix.length)
    : category
  return baseNodes.filter((n) => {
    const nodeCategory = n.category.startsWith(rootPrefix)
      ? n.category.slice(rootPrefix.length)
      : n.category
    return (
      nodeCategory === categoryPath ||
      nodeCategory.startsWith(categoryPath + '/')
    )
  })
}

const displayedResults = computed<ComfyNodeDefImpl[]>(() => {
  const baseNodes = rootFilteredNodeDefs.value
  const category = selectedCategory.value

  if (category === DEFAULT_CATEGORY) return getMostRelevantResults(baseNodes)

  const hasSearch = searchQuery.value || filters.length > 0
  let source: ComfyNodeDefImpl[]
  if (hasSearch) {
    const searched = searchResults.value
    if (rootFilter.value) {
      const rootSet = new Set(baseNodes.map((n) => n.name))
      source = searched.filter((n) => rootSet.has(n.name))
    } else {
      source = searched
    }
  } else {
    source = baseNodes
  }

  const sourceFilter = sourceCategoryFilters[category]
  if (sourceFilter) return source.filter(sourceFilter)
  return getCategoryResults(source, category)
})

const hoveredNodeDef = computed(
  () => displayedResults.value[selectedIndex.value] ?? null
)

watch(
  hoveredNodeDef,
  (newVal) => {
    emit('hoverNode', newVal)
  },
  { immediate: true }
)

watch([selectedCategory, searchQuery, rootFilter, () => filters.length], () => {
  selectedIndex.value = 0
})

function onPointerMove(event: PointerEvent) {
  const item = (event.target as HTMLElement).closest('[role=option]')
  if (!item) return
  const index = Number(item.id.replace('result-item-', ''))
  if (!isNaN(index) && index !== selectedIndex.value)
    selectedIndex.value = index
}

function navigateResults(direction: number, focusItem = false) {
  const newIndex = selectedIndex.value + direction
  if (newIndex >= 0 && newIndex < displayedResults.value.length) {
    selectedIndex.value = newIndex
    nextTick(() => {
      const el = dialogRef.value?.querySelector(
        `#result-item-${newIndex}`
      ) as HTMLElement | null
      el?.scrollIntoView({ block: 'nearest' })
      if (focusItem) el?.focus()
    })
  }
}

function selectCurrentResult() {
  const node = displayedResults.value[selectedIndex.value]
  if (node) emit('addNode', node)
}
</script>
