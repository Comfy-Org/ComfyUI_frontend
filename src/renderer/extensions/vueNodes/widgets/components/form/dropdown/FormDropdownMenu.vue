<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

import { isCanvasGestureWheel } from '@/base/wheelGestures'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'
import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import type { FormDropdownItem, LayoutMode, SortOption } from './types'

interface Props {
  items: FormDropdownItem[]
  isSelected: (item: FormDropdownItem, index: number) => boolean
  filterOptions: FilterOption[]
  sortOptions: SortOption[]
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
  uploadable?: boolean
  accept?: string
  candidateIndex?: number
  candidateLabel?: string
  /** Names pinned to the top under a "Recently used" heading. */
  pinTopNames?: string[]
}

const {
  items,
  isSelected,
  filterOptions,
  sortOptions,
  showOwnershipFilter,
  ownershipOptions,
  showBaseModelFilter,
  baseModelOptions,
  uploadable,
  accept,
  candidateIndex = -1,
  candidateLabel,
  pinTopNames
} = defineProps<Props>()
const emit = defineEmits<{
  (e: 'item-click', item: FormDropdownItem, index: number): void
  (e: 'search-enter'): void
  (e: 'file-change', event: Event): void
}>()

const filterSelected = defineModel<string>('filterSelected')
const layoutMode = defineModel<LayoutMode>('layoutMode')
const sortSelected = defineModel<string>('sortSelected')
const searchQuery = defineModel<string>('searchQuery')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected')
const baseModelSelected = defineModel<Set<string>>('baseModelSelected')

type LayoutConfig = {
  maxColumns: number
  itemHeight: number
  itemWidth: number
  gap: string
}

const LAYOUT_CONFIGS: Record<LayoutMode, LayoutConfig> = {
  grid: {
    maxColumns: 4,
    itemHeight: 120,
    itemWidth: 89,
    gap: '2px'
  },
  list: {
    maxColumns: 1,
    itemHeight: 64,
    itemWidth: 380,
    gap: '2px'
  },
  'list-small': {
    maxColumns: 1,
    itemHeight: 40,
    itemWidth: 380,
    gap: '2px'
  }
}

const layoutConfig = computed<LayoutConfig>(
  () => LAYOUT_CONFIGS[layoutMode.value ?? 'grid']
)

const gridStyle = computed<CSSProperties>(() => ({
  display: 'grid',
  gap: layoutConfig.value.gap,
  padding: '1rem',
  width: '100%'
}))

// "Recently used" pinned items at the top. Order follows pinTopNames; items
// missing from the current pool are silently dropped. The non-pinned tail
// retains the upstream sort order with pinned items removed to avoid dupes.
const pinnedItems = computed<FormDropdownItem[]>(() => {
  if (!pinTopNames?.length) return []
  const byName = new Map<string, FormDropdownItem>()
  for (const it of items) byName.set(it.name, it)
  const out: FormDropdownItem[] = []
  for (const name of pinTopNames) {
    const hit = byName.get(name)
    if (hit) out.push(hit)
  }
  return out
})

const remainingItems = computed<FormDropdownItem[]>(() => {
  if (pinnedItems.value.length === 0) return items.slice()
  const pinned = new Set(pinnedItems.value.map((i) => i.name))
  return items.filter((i) => !pinned.has(i.name))
})

type VirtualDropdownItem = FormDropdownItem & { key: string }
// The flat (ungrouped) list has no "Recently used" section to host pinned
// items, so it renders the full set. Only the grouped path splits pinned out
// (via pinnedItems + remainingItems) to avoid showing them twice.
const virtualItems = computed<VirtualDropdownItem[]>(() =>
  items.map((item) => ({
    ...item,
    key: String(item.id)
  }))
)

const UNKNOWN_BASE_MODEL_LABEL = '—'

// Order within a bucket starts at the first alphanumeric character, so leading
// punctuation ("-", "[", "/") doesn't drag a name out of place. Numbers sort
// before letters (localeCompare numeric ordering).
const LEADING_NON_ALPHANUMERIC = /^[^\p{L}\p{N}]+/u

function bucketSortKey(item: FormDropdownItem): string {
  return (item.label ?? item.name).replace(LEADING_NON_ALPHANUMERIC, '')
}

function compareBucketItems(a: FormDropdownItem, b: FormDropdownItem): number {
  return bucketSortKey(a).localeCompare(bucketSortKey(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

// Base-model sort buckets items under per-base-model headings so the dropdown
// matches the Model Library sidebar. Items compatible with multiple base
// models appear under each; items with none fall into a trailing "—" bucket.
// Bucket headings order by the asc/desc id; items within a bucket order A–Z
// from their first alphanumeric character.
const groupedByBaseModel = computed<
  { baseModel: string; items: FormDropdownItem[] }[] | null
>(() => {
  if (
    sortSelected.value !== 'base-model-asc' &&
    sortSelected.value !== 'base-model-desc'
  )
    return null
  const buckets = new Map<string, FormDropdownItem[]>()
  for (const item of remainingItems.value) {
    const bases = item.base_models ?? []
    if (bases.length === 0) {
      const list = buckets.get(UNKNOWN_BASE_MODEL_LABEL) ?? []
      list.push(item)
      buckets.set(UNKNOWN_BASE_MODEL_LABEL, list)
      continue
    }
    for (const base of bases) {
      const list = buckets.get(base) ?? []
      list.push(item)
      buckets.set(base, list)
    }
  }
  const direction = sortSelected.value === 'base-model-desc' ? -1 : 1
  const labels = Array.from(buckets.keys()).sort((a, b) => {
    if (a === UNKNOWN_BASE_MODEL_LABEL && b !== UNKNOWN_BASE_MODEL_LABEL)
      return 1
    if (b === UNKNOWN_BASE_MODEL_LABEL && a !== UNKNOWN_BASE_MODEL_LABEL)
      return -1
    return direction * a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
  return labels.map((baseModel) => ({
    baseModel,
    items: (buckets.get(baseModel) ?? []).slice().sort(compareBucketItems)
  }))
})

function flatIndex(sectionIdx: number, itemIdx: number): number {
  const groups = groupedByBaseModel.value
  if (!groups) return itemIdx
  let n = 0
  for (let i = 0; i < sectionIdx; i++) n += groups[i].items.length
  return n + itemIdx
}

/**
 * The dropdown content is teleported to `document.body` by PrimeVue Popover,
 * detaching it from the LGraphNode subtree where the canvas wheel guard lives.
 * Suppress only the destructive browser defaults (page zoom on pinch and
 * back/forward on horizontal swipe); regular vertical scrolling still
 * scrolls the dropdown's own content.
 */
const onWheel = (event: WheelEvent) => {
  if (isCanvasGestureWheel(event)) event.preventDefault()
}
</script>

<template>
  <div
    class="flex max-h-[640px] w-103 flex-col rounded-lg bg-base-background pt-4 outline -outline-offset-1 outline-node-component-border"
    data-capture-wheel="true"
    data-testid="form-dropdown-menu"
    @wheel="onWheel"
  >
    <FormDropdownMenuFilter
      v-if="filterOptions.length > 0"
      v-model:filter-selected="filterSelected"
      :filter-options
      :uploadable
      :accept
      @file-change="emit('file-change', $event)"
    />
    <FormDropdownMenuActions
      v-model:sort-selected="sortSelected"
      v-model:search-query="searchQuery"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :sort-options
      :show-ownership-filter
      :ownership-options
      :show-base-model-filter
      :base-model-options
      :candidate-label
      @search-enter="emit('search-enter')"
    />
    <div
      v-if="items.length === 0"
      class="flex h-50 items-center justify-center"
    >
      <i
        :title="$t('g.noItems')"
        :aria-label="$t('g.noItems')"
        class="icon-[lucide--circle-off] size-30 text-muted-foreground/20"
      />
    </div>
    <div
      v-else-if="groupedByBaseModel"
      class="mt-2 flex min-h-0 flex-auto flex-col overflow-y-auto px-4 pb-4"
    >
      <section v-if="pinnedItems.length > 0" class="flex flex-col">
        <h3
          class="bg-base-background pt-1 pb-0.5 text-2xs tracking-wide text-muted-foreground uppercase"
        >
          {{ $t('assetBrowser.recentlyUsed') }}
        </h3>
        <div
          :style="{
            display: 'grid',
            gap: layoutConfig.gap,
            gridTemplateColumns:
              layoutMode === 'grid'
                ? `repeat(${layoutConfig.maxColumns}, minmax(0, 1fr))`
                : 'minmax(0, 1fr)'
          }"
        >
          <FormDropdownMenuItem
            v-for="(item, pinIdx) in pinnedItems"
            :key="`pinned-${item.id}`"
            :index="pinIdx"
            :selected="isSelected(item, pinIdx)"
            :preview-url="item.preview_url ?? ''"
            :name="item.name"
            :label="item.label"
            :author="item.author"
            :base-models="item.base_models"
            :placeholder-category="item.placeholder_category"
            :layout="layoutMode"
            @click="emit('item-click', item, pinIdx)"
          />
        </div>
      </section>
      <section
        v-for="(group, sectionIdx) in groupedByBaseModel"
        :key="group.baseModel"
        class="flex flex-col"
      >
        <h3
          class="sticky -top-px z-10 bg-base-background pt-1 pb-0.5 text-2xs tracking-wide text-muted-foreground uppercase"
        >
          {{ group.baseModel }}
        </h3>
        <div
          :style="{
            display: 'grid',
            gap: layoutConfig.gap,
            gridTemplateColumns:
              layoutMode === 'grid'
                ? `repeat(${layoutConfig.maxColumns}, minmax(0, 1fr))`
                : 'minmax(0, 1fr)'
          }"
        >
          <FormDropdownMenuItem
            v-for="(item, itemIdx) in group.items"
            :key="item.id"
            :index="flatIndex(sectionIdx, itemIdx)"
            :candidate="flatIndex(sectionIdx, itemIdx) === candidateIndex"
            :selected="isSelected(item, flatIndex(sectionIdx, itemIdx))"
            :preview-url="item.preview_url ?? ''"
            :name="item.name"
            :label="item.label"
            :author="item.author"
            :base-models="item.base_models"
            :placeholder-category="item.placeholder_category"
            :layout="layoutMode"
            @click="emit('item-click', item, flatIndex(sectionIdx, itemIdx))"
          />
        </div>
      </section>
    </div>
    <VirtualGrid
      v-else
      :key="layoutMode"
      :items="virtualItems"
      :grid-style
      :max-columns="layoutConfig.maxColumns"
      :default-item-height="layoutConfig.itemHeight"
      :default-item-width="layoutConfig.itemWidth"
      :buffer-rows="2"
      class="mt-1 min-h-0 flex-auto"
    >
      <template #item="{ item, index }">
        <FormDropdownMenuItem
          :index
          :candidate="index === candidateIndex"
          :selected="isSelected(item, index)"
          :preview-url="item.preview_url ?? ''"
          :name="item.name"
          :label="item.label"
          :author="item.author"
          :base-models="item.base_models"
          :placeholder-category="item.placeholder_category"
          :layout="layoutMode"
          @click="emit('item-click', item, index)"
        />
      </template>
    </VirtualGrid>
  </div>
</template>
