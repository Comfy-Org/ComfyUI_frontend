<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

import type { FilterOption, OptionId } from './types'

defineProps<{
  filterOptions: FilterOption[]
}>()

const filterSelected = defineModel<OptionId>('filterSelected')
</script>

<template>
  <div class="text-secondary mb-4 flex gap-1 px-4">
    <div
      v-for="option in filterOptions"
      :key="option.id"
      :class="
        cn(
          'px-4 py-2 rounded-md inline-flex justify-center items-center cursor-pointer select-none',
          'transition-all duration-150',
          'hover:text-base-foreground hover:bg-interface-menu-component-surface-hovered',
          'active:scale-95',
          filterSelected === option.id
            ? '!bg-interface-menu-component-surface-selected text-base-foreground'
            : 'bg-transparent'
        )
      "
      @click="filterSelected = option.id"
    >
      {{ option.name }}
    </div>
  </div>
</template>
