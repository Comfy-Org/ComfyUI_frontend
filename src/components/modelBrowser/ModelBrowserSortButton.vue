<template>
  <div class="flex items-center justify-between gap-2 w-full md:w-auto">
    <span class="text-sm text-muted-foreground"
      >{{ $t('modelBrowser.sortBy') }}:</span
    >
    <div
      class="flex items-center rounded-lg bg-secondary-background p-1 gap-1 shrink-0"
    >
      <button
        v-for="option in sortOptions"
        :key="option.value"
        :class="
          cn(
            'inline-flex items-center justify-center gap-1.5 cursor-pointer appearance-none border-none transition-colors h-8 px-3 rounded-md text-sm font-medium whitespace-nowrap',
            sortBy === option.value
              ? 'bg-base-background text-base-foreground'
              : 'bg-transparent text-muted-foreground hover:text-base-foreground'
          )
        "
        :aria-label="`${option.label} ${sortBy === option.value ? (sortDirection === 'asc' ? '(ascending)' : '(descending)') : ''}`"
        @click="handleSortClick(option.value)"
      >
        <span>{{ option.label }}</span>
        <i
          v-if="sortBy === option.value"
          :class="
            cn(
              'size-3.5 transition-transform',
              sortDirection === 'asc'
                ? 'icon-[lucide--arrow-up]'
                : 'icon-[lucide--arrow-down]'
            )
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

export interface SortOption {
  label: string
  value: 'name' | 'size' | 'modified'
}

const { sortBy, sortDirection, sortOptions } = defineProps<{
  sortBy: 'name' | 'size' | 'modified'
  sortDirection: 'asc' | 'desc'
  sortOptions: SortOption[]
}>()

const emit = defineEmits<{
  'update:sortBy': [value: 'name' | 'size' | 'modified']
  'update:sortDirection': [value: 'asc' | 'desc']
}>()

function handleSortClick(value: 'name' | 'size' | 'modified') {
  if (sortBy === value) {
    // Toggle direction if clicking the same option
    emit('update:sortDirection', sortDirection === 'asc' ? 'desc' : 'asc')
  } else {
    // Set new sort field with default ascending direction
    emit('update:sortBy', value)
    emit('update:sortDirection', 'asc')
  }
}
</script>
