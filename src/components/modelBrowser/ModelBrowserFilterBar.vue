<template>
  <div
    class="flex flex-col md:flex-row gap-2 md:gap-4 md:items-center md:justify-between px-3 sm:px-6 pt-0 pb-2 md:pb-6"
    data-component-id="model-browser-filter-bar"
  >
    <!-- File Formats Filter -->
    <MultiSelect
      v-if="availableFileFormats.length > 0"
      :model-value="selectedFileFormats"
      :label="$t('modelBrowser.fileFormats')"
      :options="availableFileFormats"
      class="w-full md:w-auto md:min-w-32"
      data-component-id="filter-file-formats"
      @update:model-value="$emit('update:selectedFileFormats', $event)"
    />

    <!-- Model Types Filter -->
    <MultiSelect
      v-if="availableModelTypes.length > 0"
      :model-value="selectedModelTypes"
      :label="$t('modelBrowser.modelTypes')"
      :options="availableModelTypes"
      class="w-full md:w-auto md:min-w-32"
      data-component-id="filter-model-types"
      @update:model-value="$emit('update:selectedModelTypes', $event)"
    />

    <!-- Right side: Sort Buttons -->
    <div
      class="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto md:ml-auto"
      data-component-id="filter-bar-right"
    >
      <div class="flex items-center w-full md:w-auto">
        <ModelBrowserSortButton
          :sort-by="sortBy"
          :sort-direction="sortDirection"
          :sort-options="sortOptions"
          @update:sort-by="$emit('update:sortBy', $event)"
          @update:sort-direction="$emit('update:sortDirection', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MultiSelect from '@/components/input/MultiSelect.vue'
import ModelBrowserSortButton from '@/components/modelBrowser/ModelBrowserSortButton.vue'
import type { SortOption } from '@/components/modelBrowser/ModelBrowserSortButton.vue'
import type { SelectOption } from '@/components/input/types'

defineProps<{
  availableFileFormats: SelectOption[]
  availableModelTypes: SelectOption[]
  selectedFileFormats: SelectOption[]
  selectedModelTypes: SelectOption[]
  sortBy: 'name' | 'size' | 'modified'
  sortDirection: 'asc' | 'desc'
  sortOptions: SortOption[]
}>()

defineEmits<{
  'update:selectedFileFormats': [value: SelectOption[]]
  'update:selectedModelTypes': [value: SelectOption[]]
  'update:sortBy': [value: 'name' | 'size' | 'modified']
  'update:sortDirection': [value: 'asc' | 'desc']
}>()
</script>
