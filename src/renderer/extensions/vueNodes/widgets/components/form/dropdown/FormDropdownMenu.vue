<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'
import FormDropdownMenuItem from './FormDropdownMenuItem.vue'
import type { DropdownItem, LayoutMode, SortOptionLabel } from './types'

interface Props {
  items: DropdownItem[]
  isSelected: (item: DropdownItem, index: number) => boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'item-click', item: DropdownItem, index: number): void
}>()

// Define models for two-way binding
const filterIndex = defineModel<number>('filterIndex', { default: 0 })
const layoutMode = defineModel<LayoutMode>('layoutMode')
const sortSelected = defineModel<SortOptionLabel>('sortSelected')

// Handle item selection
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    class="w-103 h-[640px] pt-4 bg-white dark-theme:bg-charcoal-800 rounded-lg outline outline-offset-[-1px] outline-sand-100 dark-theme:outline-zinc-800 flex flex-col"
  >
    <!-- Filter -->
    <FormDropdownMenuFilter v-model:filter-index="filterIndex" />
    <!-- Actions -->
    <FormDropdownMenuActions
      v-model:layout-mode="layoutMode"
      v-model:sort-selected="sortSelected"
    />
    <!-- List -->
    <div class="flex overflow-hidden relative">
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
        <div
          class="absolute top-0 inset-x-3 h-5 bg-gradient-to-b from-white dark-theme:from-neutral-900 to-transparent pointer-events-none z-10"
        />
        <!-- Item -->
        <FormDropdownMenuItem
          v-for="(item, index) in items"
          :key="item.id"
          :index="index"
          :selected="isSelected(item, index)"
          :image-src="item.imageSrc"
          :name="item.name"
          :metadata="item.metadata"
          :layout="layoutMode"
          @click="emit('item-click', item, index)"
        />
      </div>
    </div>
  </div>
</template>
