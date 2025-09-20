<script setup lang="ts">
import { ref } from 'vue'

import FormDropdown from './FormDropdown.vue'
import FormDropdownDrop from './FormDropdownDrop.vue'

// Data structure for dropdown items
interface DropdownItem {
  id: string | number
  imageSrc: string
  name: string
  metadata: string
}

// Mock data for demonstration
const imageItems = ref<DropdownItem[]>(
  Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    imageSrc: `https://picsum.photos/120/100?random=${index + 1}`,
    name: `Image_${String(index + 1).padStart(3, '0')}.png`,
    metadata: `${Math.floor(Math.random() * 512 + 512)} x ${Math.floor(Math.random() * 512 + 512)}`
  }))
)

// Reactive state for dropdown controls
const selectedIndex = ref(0)
const filterIndex = ref(0)
const layoutMode = ref<'list' | 'grid'>('grid')
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div class="space-y-4">
    <div
      class="flex items-center justify-between gap-2 h-[30px] overscroll-contain"
    >
      <label
        class="text-sm text-stone-200 dark-theme:text-slate-200 font-normal flex-1 truncate w-20"
        >Image</label
      >
      <div ref="triggerRef" class="w-75">
        <FormDropdown
          v-model:selected-index="selectedIndex"
          v-model:filter-index="filterIndex"
          v-model:layout-mode="layoutMode"
          :items="imageItems"
          placeholder="Select Image..."
          multiple
        />
      </div>
    </div>

    <FormDropdownDrop />
  </div>
</template>
