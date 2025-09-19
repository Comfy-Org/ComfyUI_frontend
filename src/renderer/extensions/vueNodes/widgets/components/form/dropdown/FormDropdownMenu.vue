<script setup lang="ts">
import { ref } from 'vue'

import FormDropdownMenuActions from './FormDropdownMenuActions.vue'
import FormDropdownMenuFilter from './FormDropdownMenuFilter.vue'
import FormDropdownMenuItem from './FormDropdownMenuItem.vue'

const filterIndex = ref(0)
const layoutMode = ref<'list' | 'grid'>('grid')
const selectedIndex = ref(0)
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
          v-for="i in 4 * 10"
          :key="i"
          :index="i"
          :selected-index="selectedIndex"
          :image-src="`https://picsum.photos/120/100?random=${i}`"
          name="ImageName.png"
          metadata="1024 x 1024"
          @click="selectedIndex = $event"
        />
      </div>
    </div>
  </div>
</template>
