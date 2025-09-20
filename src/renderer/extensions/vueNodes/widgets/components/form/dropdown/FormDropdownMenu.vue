<script setup lang="ts">
import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'
import FormDropdownMenuItem from './FormDropdownMenuItem.vue'

// Data structure interfaces
interface DropdownItem {
  id: string | number
  imageSrc: string
  name: string
  metadata: string
}

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
const layoutMode = defineModel<'list' | 'grid'>('layoutMode', {
  default: 'grid'
})

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
    <FormDropdownMenuActions v-model:layout-mode="layoutMode" />
    <!-- List -->
    <div class="flex overflow-hidden relative">
      <div
        class="h-full max-h-full grid grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto px-4 pt-4 pb-4"
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
          @click="emit('item-click', item, index)"
        />
      </div>
    </div>
  </div>
</template>
