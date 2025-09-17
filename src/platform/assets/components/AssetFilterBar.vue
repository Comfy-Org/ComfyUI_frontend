<template>
  <div :class="containerClasses" data-component-id="asset-filter-bar">
    <div :class="leftSideClasses" data-component-id="asset-filter-bar-left">
      <MultiSelect
        v-model="fileFormats"
        label="File formats"
        :options="fileFormatOptions"
        :class="selectClasses"
        data-component-id="asset-filter-file-formats"
        @update:model-value="handleFilterChange"
      />

      <MultiSelect
        v-model="baseModels"
        label="Base models"
        :options="baseModelOptions"
        :class="selectClasses"
        data-component-id="asset-filter-base-models"
        @update:model-value="handleFilterChange"
      />
    </div>

    <div :class="rightSideClasses" data-component-id="asset-filter-bar-right">
      <SingleSelect
        v-model="sortBy"
        label="Sort by"
        :options="sortOptions"
        :class="selectClasses"
        data-component-id="asset-filter-sort"
        @update:model-value="handleFilterChange"
      >
        <template #icon>
          <div :class="cn('icon-[lucide--arrow-up-down]', 'size-3')" />
        </template>
      </SingleSelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import MultiSelect from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import type { SelectOption } from '@/components/input/types'
import { cn } from '@/utils/tailwindUtil'

export interface FilterState {
  fileFormats: string[]
  baseModels: string[]
  sortBy: string
}

const fileFormats = ref<SelectOption[]>([])
const baseModels = ref<SelectOption[]>([])
const sortBy = ref('name-asc')

// TODO: Make fileFormatOptions configurable via props or assetService
// Should support dynamic file formats based on available assets or server capabilities
const fileFormatOptions = [
  { name: '.ckpt', value: 'ckpt' },
  { name: '.safetensors', value: 'safetensors' },
  { name: '.pt', value: 'pt' }
]

// TODO: Make baseModelOptions configurable via props or assetService
// Should support dynamic base models based on available assets or server detection
const baseModelOptions = [
  { name: 'SD 1.5', value: 'sd15' },
  { name: 'SD XL', value: 'sdxl' },
  { name: 'SD 3.5', value: 'sd35' }
]

// TODO: Make sortOptions configurable via props
// Different asset types might need different sorting options
const sortOptions = [
  { name: 'A-Z', value: 'name-asc' },
  { name: 'Z-A', value: 'name-desc' },
  { name: 'Recent', value: 'recent' },
  { name: 'Popular', value: 'popular' }
]

const emit = defineEmits<{
  filterChange: [filters: FilterState]
}>()

const containerClasses = cn(
  'flex gap-4 items-center justify-between',
  'px-6 pt-2 pb-6'
)
const leftSideClasses = cn('flex gap-4 items-center')
const rightSideClasses = cn('flex items-center')
const selectClasses = cn('min-w-32')

function handleFilterChange() {
  emit('filterChange', {
    fileFormats: fileFormats.value.map((option: SelectOption) => option.value),
    baseModels: baseModels.value.map((option: SelectOption) => option.value),
    sortBy: sortBy.value
  })
}
</script>
