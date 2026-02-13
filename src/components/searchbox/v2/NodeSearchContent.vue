<template>
  <div
    ref="dialogRef"
    class="flex max-h-[50vh] min-h-[400px] w-full flex-col overflow-hidden rounded-lg bg-base-background"
  >
    <!-- Search input row -->
    <div class="px-4 py-3">
      <div
        class="flex cursor-text flex-wrap items-center gap-2 rounded-lg bg-secondary-background px-4 py-3"
        @click="inputRef?.focus()"
      >
        <!-- Active filter label (filter selection mode) -->
        <span
          v-if="activeFilter"
          class="shrink-0 rounded bg-highlight px-2 py-1 -my-1 text-sm opacity-80 text-foreground"
        >
          {{ activeFilter.label }}:
        </span>
        <!-- Applied filter chips -->
        <template v-if="!activeFilter">
          <NodeSearchFilterChip
            v-for="filter in filters"
            :key="filter.filterDef.id"
            :label="t(`g.${filter.filterDef.id}`)"
            :text="filter.value"
            :type-color="
              filter.filterDef.id === 'input' ||
              filter.filterDef.id === 'output'
                ? getTypeColor(filter.value)
                : undefined
            "
            @remove="emit('removeFilter', filter)"
          />
        </template>
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="true"
          :aria-controls="activeFilter ? 'filter-options-list' : 'results-list'"
          :aria-label="inputPlaceholder"
          :placeholder="inputPlaceholder"
          class="h-6 min-w-[min(300px,80vw)] flex-1 border-none bg-transparent text-foreground text-[14px] outline-none placeholder:text-muted-foreground"
          @keydown.down.prevent="onKeyDown"
          @keydown.up.prevent="onKeyUp"
          @keydown.enter.prevent="onKeyEnter"
        />
      </div>
    </div>

    <!-- Filter header row -->
    <div class="flex items-center">
      <div class="w-40 shrink-0 px-3 py-2 text-sm text-muted-foreground">
        {{ $t('g.filterBy') }}
      </div>
      <NodeSearchFilterBar
        class="flex-1"
        :active-chip-key="activeFilter?.key"
        @select-chip="onSelectFilterChip"
      />
    </div>

    <!-- Content area -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Category sidebar (hidden in filter mode) -->
      <NodeSearchCategorySidebar
        v-if="!activeFilter"
        v-model:selected-category="sidebarCategory"
        class="w-40 shrink-0"
      />

      <!-- Filter options list (filter selection mode) -->
      <NodeSearchFilterPanel
        v-if="activeFilter"
        ref="filterPanelRef"
        v-model:query="filterQuery"
        :chip="activeFilter"
        @apply="onFilterApply"
      />

      <!-- Results list (normal mode) -->
      <div
        v-else
        id="results-list"
        role="listbox"
        class="flex-1 overflow-y-auto py-2"
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
              'cursor-pointer px-4 py-2',
              index === selectedIndex && 'bg-highlight'
            )
          "
          @click="onAddNode(node, $event)"
          @mouseenter="selectedIndex = index"
        >
          <NodeSearchListItem
            :node-def="node"
            :current-query="searchQuery"
            show-description
            show-source-badge
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
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FilterChip } from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import NodeSearchCategorySidebar from '@/components/searchbox/v2/NodeSearchCategorySidebar.vue'
import NodeSearchFilterChip from '@/components/searchbox/v2/NodeSearchFilterChip.vue'
import NodeSearchFilterPanel from '@/components/searchbox/v2/NodeSearchFilterPanel.vue'
import NodeSearchListItem from '@/components/searchbox/v2/NodeSearchListItem.vue'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
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

function getTypeColor(typeName: string): string | undefined {
  return LGraphCanvas.link_type_colors[typeName]
}

const { t } = useI18n()
const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()
const nodeBookmarkStore = useNodeBookmarkStore()

const dialogRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const filterPanelRef = ref<InstanceType<typeof NodeSearchFilterPanel>>()

const searchQuery = ref('')
const selectedCategory = ref('most-relevant')
const selectedIndex = ref(0)

// Filter selection mode
const activeFilter = ref<FilterChip | null>(null)
const filterQuery = ref('')

const inputValue = computed({
  get: () => (activeFilter.value ? filterQuery.value : searchQuery.value),
  set: (value: string) => {
    if (activeFilter.value) {
      filterQuery.value = value
    } else {
      searchQuery.value = value
    }
  }
})

const inputPlaceholder = computed(() =>
  activeFilter.value
    ? t('g.filterByType', { type: activeFilter.value.label.toLowerCase() })
    : t('g.addNode')
)

function lockDialogHeight() {
  if (dialogRef.value) {
    dialogRef.value.style.height = `${dialogRef.value.offsetHeight}px`
  }
}

function unlockDialogHeight() {
  if (dialogRef.value) {
    dialogRef.value.style.height = ''
  }
}

function onSelectFilterChip(chip: FilterChip) {
  if (activeFilter.value?.key === chip.key) {
    cancelFilter()
    return
  }
  lockDialogHeight()
  activeFilter.value = chip
  filterQuery.value = ''
  nextTick(() => inputRef.value?.focus())
}

function onFilterApply(value: string) {
  if (!activeFilter.value) return
  emit('addFilter', { filterDef: activeFilter.value.filter, value })
  activeFilter.value = null
  filterQuery.value = ''
  unlockDialogHeight()
  nextTick(() => inputRef.value?.focus())
}

function cancelFilter() {
  activeFilter.value = null
  filterQuery.value = ''
  unlockDialogHeight()
  nextTick(() => inputRef.value?.focus())
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

const displayedResults = computed<ComfyNodeDefImpl[]>(() => {
  const allNodes = nodeDefStore.visibleNodeDefs

  let results: ComfyNodeDefImpl[]
  switch (effectiveCategory.value) {
    case 'most-relevant':
      return searchResults.value
    case 'favorites':
      results = allNodes.filter((n) => nodeBookmarkStore.isBookmarked(n))
      break
    case 'essentials':
      return []
    case 'custom':
      results = allNodes.filter(
        (n) => n.nodeSource.type !== NodeSourceType.Core
      )
      break
    default:
      results = allNodes.filter(
        (n) =>
          n.category === selectedCategory.value ||
          n.category.startsWith(selectedCategory.value + '/')
      )
      break
  }

  return filters.length > 0 ? results.filter(matchesFilters) : results
})

const hoveredNodeDef = computed(
  () => displayedResults.value[selectedIndex.value] ?? null
)

watchEffect(() => {
  emit('hoverNode', hoveredNodeDef.value)
})

watch([selectedCategory, searchQuery, () => filters], () => {
  selectedIndex.value = 0
})

// Keyboard navigation
function onKeyDown() {
  if (activeFilter.value) {
    filterPanelRef.value?.navigate(1)
  } else {
    navigateResults(1)
  }
}

function onKeyUp() {
  if (activeFilter.value) {
    filterPanelRef.value?.navigate(-1)
  } else {
    navigateResults(-1)
  }
}

function onKeyEnter() {
  if (activeFilter.value) {
    filterPanelRef.value?.selectCurrent()
  } else {
    selectCurrentResult()
  }
}

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
  if (node) {
    onAddNode(node)
  }
}

function onAddNode(nodeDef: ComfyNodeDefImpl, event?: MouseEvent) {
  emit('addNode', nodeDef, event)
}

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
})
</script>
