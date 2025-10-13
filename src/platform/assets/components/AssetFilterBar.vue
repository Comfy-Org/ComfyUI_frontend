<template>
  <div :class="containerClasses" data-component-id="asset-filter-bar">
    <div :class="leftSideClasses" data-component-id="asset-filter-bar-left">
      <MultiSelect
        v-if="availableFileFormats.length > 0"
        v-model="fileFormats"
        :label="$t('assetBrowser.fileFormats')"
        :options="availableFileFormats"
        :class="selectClasses"
        data-component-id="asset-filter-file-formats"
        @update:model-value="handleFilterChange"
      />

      <MultiSelect
        v-if="availableBaseModels.length > 0"
        v-model="baseModels"
        :label="$t('assetBrowser.baseModels')"
        :options="availableBaseModels"
        :class="selectClasses"
        data-component-id="asset-filter-base-models"
        @update:model-value="handleFilterChange"
      />
    </div>

    <div :class="rightSideClasses" data-component-id="asset-filter-bar-right">
      <SingleSelect
        v-model="sortBy"
        :label="$t('assetBrowser.sortBy')"
        :options="sortOptions"
        :class="selectClasses"
        data-component-id="asset-filter-sort"
        @update:model-value="handleFilterChange"
      >
        <template #icon>
          <i class="icon-[lucide--arrow-up-down] size-3" />
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
import { t } from '@/i18n'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { cn } from '@/utils/tailwindUtil'

export interface FilterState {
  fileFormats: string[]
  baseModels: string[]
  sortBy: string
}

const { assets = [] } = defineProps<{
  assets?: AssetItem[]
}>()

const fileFormats = ref<SelectOption[]>([])
const baseModels = ref<SelectOption[]>([])
const sortBy = ref('name-asc')

const { availableFileFormats, availableBaseModels } =
  useAssetFilterOptions(assets)

const sortOptions = [
  { name: t('assetBrowser.sortAZ'), value: 'name-asc' },
  { name: t('assetBrowser.sortZA'), value: 'name-desc' },
  { name: t('assetBrowser.sortRecent'), value: 'recent' }
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
