<template>
  <div
    ref="dialogRef"
    class="flex max-h-[50vh] min-h-[400px] w-full flex-col overflow-hidden rounded-lg border border-interface-stroke bg-base-background"
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
      />

      <!-- Results list -->
      <div
        id="results-list"
        role="listbox"
        class="flex-1 overflow-y-auto py-2"
        @pointermove="onPointerMove"
      >
        <div
          v-for="(node, index) in displayedResults"
          :id="`result-item-${index}`"
          :key="node.name"
          role="option"
          data-testid="result-item"
          :aria-selected="index === selectedIndex"
          :class="
            cn(
              'flex cursor-pointer items-center px-4 h-14',
              index === selectedIndex && 'bg-secondary-background-hover'
            )
          "
          @click="emit('addNode', node, $event)"
        >
          <NodeSearchListItem
            :node-def="node"
            :current-query="searchQuery"
            show-description
            :show-source-badge="rootFilter !== 'essentials'"
            :hide-bookmark-icon="effectiveCategory === 'favorites'"
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
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import NodeSearchCategorySidebar from '@/components/searchbox/v2/NodeSearchCategorySidebar.vue'
import NodeSearchInput from '@/components/searchbox/v2/NodeSearchInput.vue'
import NodeSearchListItem from '@/components/searchbox/v2/NodeSearchListItem.vue'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'
import { cn } from '@/utils/tailwindUtil'

const { filters } = defineProps<{
  filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
}>()

const emit = defineEmits<{
  addNode: [nodeDef: ComfyNodeDefImpl, dragEvent?: MouseEvent]
  addFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  removeFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  hoverNode: [nodeDef: ComfyNodeDefImpl | null]
}>()

const BLUEPRINT_CATEGORY = 'Subgraph Blueprints'

const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()
const nodeBookmarkStore = useNodeBookmarkStore()

function isEssentialNode(n: ComfyNodeDefImpl): boolean {
  return n.nodeSource.type === NodeSourceType.Essentials
}

function isCustomNode(n: ComfyNodeDefImpl): boolean {
  return (
    n.nodeSource.type !== NodeSourceType.Core &&
    !isEssentialNode(n) &&
    n.python_module !== 'blueprint'
  )
}

const dialogRef = ref<HTMLElement>()
const searchInputRef = ref<InstanceType<typeof NodeSearchInput>>()

onMounted(() => {
  if (dialogRef.value) {
    dialogRef.value.style.height = `${dialogRef.value.offsetHeight}px`
  }
})

const searchQuery = ref('')
const selectedCategory = ref('most-relevant')
const selectedIndex = ref(0)

// Root filter from filter bar category buttons (radio toggle)
const rootFilter = ref<string | null>(null)

const rootFilteredNodeDefs = computed(() => {
  if (!rootFilter.value) return nodeDefStore.visibleNodeDefs
  const allNodes = nodeDefStore.visibleNodeDefs
  switch (rootFilter.value) {
    case BLUEPRINT_CATEGORY:
      return allNodes.filter((n) => n.category.startsWith(rootFilter.value!))
    case 'partner-nodes':
      return allNodes.filter((n) => n.api_node)
    case 'essentials':
      return allNodes.filter(isEssentialNode)
    case 'custom':
      return allNodes.filter(isCustomNode)
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
  selectedCategory.value = 'most-relevant'
  searchQuery.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

// Node search
const searchResults = computed(() => {
  if (!searchQuery.value && filters.length === 0) {
    return nodeFrequencyStore.topNodeDefs
  }
  return nodeDefStore.nodeSearchService.searchNode(searchQuery.value, filters, {
    limit: 64
  })
})

const effectiveCategory = computed(() =>
  searchQuery.value ? 'most-relevant' : selectedCategory.value
)

const sidebarCategory = computed({
  get: () => effectiveCategory.value,
  set: (category: string) => {
    selectedCategory.value = category
    searchQuery.value = ''
  }
})

function matchesFilters(node: ComfyNodeDefImpl): boolean {
  return filters.every(({ filterDef, value }) => filterDef.matches(node, value))
}

// Check if any tree category has children (for chevron visibility)
const anyTreeCategoryHasChildren = computed(() =>
  rootFilteredNodeDefs.value.some((n) => n.category.includes('/'))
)

const displayedResults = computed<ComfyNodeDefImpl[]>(() => {
  const baseNodes = rootFilteredNodeDefs.value

  let results: ComfyNodeDefImpl[]
  switch (effectiveCategory.value) {
    case 'most-relevant': {
      if (searchQuery.value || filters.length > 0) {
        const searched = searchResults.value
        if (rootFilter.value) {
          const rootSet = new Set(baseNodes.map((n) => n.name))
          return searched.filter((n) => rootSet.has(n.name))
        }
        return searched
      }
      if (rootFilter.value) {
        return baseNodes
      }
      return nodeFrequencyStore.topNodeDefs
    }
    case 'favorites':
      results = baseNodes.filter((n) => nodeBookmarkStore.isBookmarked(n))
      break
    case 'essentials':
      results = baseNodes.filter(isEssentialNode)
      break
    case 'custom':
      results = baseNodes.filter(isCustomNode)
      break
    default:
      results = baseNodes.filter(
        (n) =>
          n.category === effectiveCategory.value ||
          n.category.startsWith(effectiveCategory.value + '/')
      )
      break
  }

  return filters.length > 0 ? results.filter(matchesFilters) : results
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

watch([selectedCategory, searchQuery, rootFilter, () => filters], () => {
  selectedIndex.value = 0
})

function onPointerMove(event: PointerEvent) {
  const item = (event.target as HTMLElement).closest('[role=option]')
  if (!item) return
  const index = Number(item.id.replace('result-item-', ''))
  if (!isNaN(index) && index !== selectedIndex.value)
    selectedIndex.value = index
}

// Keyboard navigation
function navigateResults(direction: number) {
  const newIndex = selectedIndex.value + direction
  if (newIndex >= 0 && newIndex < displayedResults.value.length) {
    selectedIndex.value = newIndex
    nextTick(() => {
      dialogRef.value
        ?.querySelector(`#result-item-${newIndex}`)
        ?.scrollIntoView({ block: 'nearest' })
    })
  }
}

function selectCurrentResult() {
  const node = displayedResults.value[selectedIndex.value]
  if (node) emit('addNode', node)
}
</script>
