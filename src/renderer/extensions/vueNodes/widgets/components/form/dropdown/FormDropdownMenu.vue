<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, toValue } from 'vue'

import VirtualGrid from '@comfyorg/design-system/common/VirtualGrid'

import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@comfyorg/assets-core/filtering'
import { isPaged, pagedItems } from '@/utils/pagedList'
import type { MaybePaged } from '@/utils/pagedList'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'
import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import type {
  FormDropdownItem,
  LayoutMode,
  SortOption,
  ThumbnailSize
} from './types'

interface Props {
  items: MaybePaged<FormDropdownItem>
  isSelected: (item: FormDropdownItem, index: number) => boolean
  uploadable: boolean
  filterOptions: FilterOption[]
  sortOptions: SortOption[]
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
  candidateIndex?: number
  candidateLabel?: string
  hasThumbnailSizes?: boolean
}

const {
  items,
  isSelected,
  uploadable,
  filterOptions,
  sortOptions,
  showOwnershipFilter,
  ownershipOptions,
  showBaseModelFilter,
  baseModelOptions,
  candidateIndex = -1,
  candidateLabel
} = defineProps<Props>()
const emit = defineEmits<{
  (e: 'item-click', item: FormDropdownItem, index: number): void
  (e: 'search-enter'): void
  (e: 'show-picker'): void
}>()

const filterSelected = defineModel<string>('filterSelected')
const layoutMode = defineModel<LayoutMode>('layoutMode')
const thumbnailSize = defineModel<ThumbnailSize>('thumbnailSize')
const sortSelected = defineModel<string>('sortSelected')
const searchQuery = defineModel<string>('searchQuery')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected')
const baseModelSelected = defineModel<Set<string>>('baseModelSelected')

type LayoutConfig = {
  maxColumns: number
  itemHeight: number
  minItemWidth?: number
  gap: string
}

const LAYOUT_CONFIGS: Record<LayoutMode, LayoutConfig> = {
  grid: {
    maxColumns: 4,
    itemHeight: 120,
    minItemWidth: 96,
    gap: 'var(--spacing-4) var(--spacing-2)'
  },
  list: {
    maxColumns: 1,
    itemHeight: 64,
    gap: 'var(--spacing-2)'
  },
  'list-small': {
    maxColumns: 1,
    itemHeight: 40,
    gap: 'var(--spacing-1)'
  }
}

const thumbnailLayouts = {
  compact: { maxColumns: 5, itemHeight: 104, minItemWidth: 76 },
  standard: LAYOUT_CONFIGS.grid,
  large: { maxColumns: 1, itemHeight: 412 }
} satisfies Record<
  ThumbnailSize,
  Pick<LayoutConfig, 'maxColumns' | 'itemHeight' | 'minItemWidth'>
>

const layoutConfig = computed<LayoutConfig>(() => {
  const layout = layoutMode.value ?? 'grid'
  return layout === 'grid'
    ? {
        ...LAYOUT_CONFIGS.grid,
        ...thumbnailLayouts[thumbnailSize.value ?? 'standard']
      }
    : LAYOUT_CONFIGS[layout]
})

const gridStyle = computed<CSSProperties>(() => ({
  display: 'grid',
  gap: layoutConfig.value.gap,
  padding: '1rem',
  width: '100%'
}))

const menuItems = computed(() => pagedItems(items))
const hasMore = computed(() => isPaged(items) && toValue(items.hasMore))
const isLoadingMore = computed(() => isPaged(items) && toValue(items.isLoading))

function loadMore() {
  return isPaged(items) ? items.loadMore() : undefined
}

const onWheel = (event: WheelEvent) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault()
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col rounded-lg bg-node pt-4 outline -outline-offset-1 outline-node-border"
    data-capture-wheel="true"
    data-testid="form-dropdown-menu"
    @wheel="onWheel"
  >
    <FormDropdownMenuFilter
      v-if="filterOptions.length > 0"
      v-model:filter-selected="filterSelected"
      :filter-options
      :uploadable
      @show-picker="emit('show-picker')"
    />
    <FormDropdownMenuActions
      v-model:layout-mode="layoutMode"
      v-model:sort-selected="sortSelected"
      v-model:search-query="searchQuery"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      v-model:thumbnail-size="thumbnailSize"
      :has-thumbnail-sizes
      :sort-options
      :show-ownership-filter
      :ownership-options
      :show-base-model-filter
      :base-model-options
      :candidate-label
      @search-enter="emit('search-enter')"
    />
    <div
      v-if="menuItems.length === 0 && !hasMore"
      class="flex h-50 items-center justify-center"
    >
      <i
        :title="$t('g.noItems')"
        :aria-label="$t('g.noItems')"
        class="icon-[lucide--circle-off] size-30 text-muted-foreground/20"
      />
    </div>
    <VirtualGrid
      v-else
      :key="layoutMode === 'grid' ? thumbnailSize : layoutMode"
      :items="menuItems"
      :grid-style
      :max-columns="layoutConfig.maxColumns"
      :default-item-height="layoutConfig.itemHeight"
      :min-item-width="layoutConfig.minItemWidth"
      :buffer-rows="2"
      class="mt-2 min-h-0 flex-1"
      :on-load-more="loadMore"
      :can-load-more="hasMore"
    >
      <template #item="{ item, index }">
        <FormDropdownMenuItem
          :index
          :candidate="index === candidateIndex"
          :selected="isSelected(item, index)"
          :thumbnail="item.thumbnail"
          :name="item.name"
          :label="item.label"
          :layout="layoutMode"
          @click="emit('item-click', item, index)"
        />
      </template>
    </VirtualGrid>
    <div
      v-if="isLoadingMore"
      class="flex items-center justify-center py-2"
      data-testid="form-dropdown-loading-more"
    >
      <i
        :aria-label="$t('g.loading')"
        class="icon-[lucide--loader] size-6 animate-spin text-muted-foreground"
      />
    </div>
  </div>
</template>
