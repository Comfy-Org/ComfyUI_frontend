<script setup lang="ts">
import type { MaybeRefOrGetter } from 'vue'

import { cn } from '@/utils/tailwindUtil'

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
  searcher?: (
    query: string,
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<void>
  updateKey?: MaybeRefOrGetter<unknown>
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'item-click', item: FormDropdownItem, index: number): void
}>()

const filterSelected = defineModel<string>('filterSelected')
const layoutMode = defineModel<LayoutMode>('layoutMode')
const sortSelected = defineModel<string>('sortSelected')
const searchQuery = defineModel<string>('searchQuery')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected')
const baseModelSelected = defineModel<Set<string>>('baseModelSelected')
</script>

<template>
  <div
    class="flex max-h-[640px] w-103 flex-col rounded-lg bg-component-node-background pt-4 outline outline-offset-[-1px] outline-node-component-border"
  >
    <FormDropdownMenuFilter
      v-if="filterOptions.length > 0"
      v-model:filter-selected="filterSelected"
      :filter-options
    />
    <FormDropdownMenuActions
      v-model:layout-mode="layoutMode"
      v-model:sort-selected="sortSelected"
      v-model:search-query="searchQuery"
      v-model:ownership-selected="ownershipSelected"
      v-model:base-model-selected="baseModelSelected"
      :sort-options
      :searcher
      :update-key
      :show-ownership-filter
      :ownership-options
      :show-base-model-filter
      :base-model-options
    />
    <div class="relative flex h-full mt-2 overflow-y-scroll">
      <div
        :class="
          cn(
            'h-full max-h-full grid gap-x-2 gap-y-4 overflow-y-auto px-4 pt-4 pb-4 w-full',
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
          class="h-50 col-span-full flex items-center justify-center"
        >
          <i
            :title="$t('g.noItems')"
            :aria-label="$t('g.noItems')"
            class="icon-[lucide--circle-off] size-30 text-zinc-500/20"
          />
        </div>
        <FormDropdownMenuItem
          v-for="(item, index) in items"
          :key="item.id"
          :index="index"
          :selected="isSelected(item, index)"
          :preview-url="item.preview_url ?? ''"
          :name="item.name"
          :label="item.label"
          :layout="layoutMode"
          @click="emit('item-click', item, index)"
        />
      </div>
    </div>
  </div>
</template>
