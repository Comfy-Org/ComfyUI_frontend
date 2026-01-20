<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'
import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import type {
  DropdownItem,
  FilterOption,
  LayoutMode,
  OptionId,
  SortOption
} from './types'

interface Props {
  items: DropdownItem[]
  isSelected: (item: DropdownItem, index: number) => boolean
  filterOptions: FilterOption[]
  sortOptions: SortOption[]
  searcher?: (
    query: string,
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<void>
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'item-click', item: DropdownItem, index: number): void
}>()

// Define models for two-way binding
const filterSelected = defineModel<OptionId>('filterSelected')
const layoutMode = defineModel<LayoutMode>('layoutMode')
const sortSelected = defineModel<OptionId>('sortSelected')
const searchQuery = defineModel<string>('searchQuery')

// Handle item selection
</script>

<template>
  <div
    class="flex max-h-[640px] w-103 flex-col rounded-lg bg-component-node-background pt-4 outline outline-offset-[-1px] outline-node-component-border"
  >
    <!-- Filter -->
    <FormDropdownMenuFilter
      v-if="filterOptions.length > 0"
      v-model:filter-selected="filterSelected"
      :filter-options="filterOptions"
    />
    <!-- Actions -->
    <FormDropdownMenuActions
      v-model:layout-mode="layoutMode"
      v-model:sort-selected="sortSelected"
      v-model:search-query="searchQuery"
      :sort-options="sortOptions"
      :searcher
    />
    <!-- List -->
    <div class="relative mt-2 flex h-full overflow-y-scroll">
      <div
        :class="
          cn(
            'grid h-full max-h-full w-full gap-x-2 gap-y-4 overflow-y-auto px-4 pt-4 pb-4',
            {
              'grid-cols-4': layoutMode === 'grid',
              'grid-cols-1 gap-y-2': layoutMode === 'list',
              'grid-cols-1 gap-y-1': layoutMode === 'list-small'
            }
          )
        "
      >
        <div class="pointer-events-none absolute inset-x-3 top-0 z-10 h-5" />
        <div
          v-if="items.length === 0"
          class="col-span-full flex h-50 items-center justify-center"
        >
          <i
            :title="$t('g.noItems')"
            :aria-label="$t('g.noItems')"
            class="icon-[lucide--circle-off] size-30 text-zinc-500/20"
          />
        </div>
        <!-- Item -->
        <FormDropdownMenuItem
          v-for="(item, index) in items"
          :key="item.id"
          :index="index"
          :selected="isSelected(item, index)"
          :media-src="item.mediaSrc"
          :name="item.name"
          :label="item.label"
          :metadata="item.metadata"
          :layout="layoutMode"
          @click="emit('item-click', item, index)"
        />
      </div>
    </div>
  </div>
</template>
