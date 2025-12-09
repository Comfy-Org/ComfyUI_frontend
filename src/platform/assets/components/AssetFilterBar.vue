<template>
  <div
    class="flex gap-4 items-center justify-between px-6 pt-2 pb-6"
    data-component-id="asset-filter-bar"
  >
    <div
      class="flex gap-4 items-center"
      data-component-id="asset-filter-bar-left"
    >
      <MultiSelect
        v-if="availableFileFormats.length > 0"
        v-model="fileFormats"
        :label="$t('assetBrowser.fileFormats')"
        :options="availableFileFormats"
        class="min-w-32"
        data-component-id="asset-filter-file-formats"
        @update:model-value="handleFilterChange"
      />

      <MultiSelect
        v-if="availableBaseModels.length > 0"
        v-model="baseModels"
        :label="$t('assetBrowser.baseModels')"
        :options="availableBaseModels"
        class="min-w-32"
        data-component-id="asset-filter-base-models"
        @update:model-value="handleFilterChange"
      />

      <SingleSelect
        v-if="hasMutableAssets"
        v-model="ownership"
        :label="$t('assetBrowser.ownership')"
        :options="ownershipOptions"
        class="min-w-42"
        data-component-id="asset-filter-ownership"
        @update:model-value="handleFilterChange"
      />
    </div>

    <div class="flex items-center" data-component-id="asset-filter-bar-right">
      <SingleSelect
        v-model="sortBy"
        :label="$t('assetBrowser.sortBy')"
        :options="sortOptions"
        class="min-w-32"
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
import { computed, ref } from 'vue'

import MultiSelect from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import type { SelectOption } from '@/components/input/types'
import { t } from '@/i18n'
import type { OwnershipOption } from '@/platform/assets/composables/useAssetBrowser'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const SORT_OPTIONS = [
  { name: t('assetBrowser.sortRecent'), value: 'recent' },
  { name: t('assetBrowser.sortAZ'), value: 'name-asc' },
  { name: t('assetBrowser.sortZA'), value: 'name-desc' }
] as const

type SortOption = (typeof SORT_OPTIONS)[number]['value']

const sortOptions = [...SORT_OPTIONS]

const ownershipOptions = [
  { name: t('assetBrowser.ownershipAll'), value: 'all' },
  { name: t('assetBrowser.ownershipMyModels'), value: 'my-models' },
  { name: t('assetBrowser.ownershipPublicModels'), value: 'public-models' }
]

export interface FilterState {
  fileFormats: string[]
  baseModels: string[]
  sortBy: string
  ownership: OwnershipOption
}

const { assets = [], allAssets = [] } = defineProps<{
  assets?: AssetItem[]
  allAssets?: AssetItem[]
}>()

const fileFormats = ref<SelectOption[]>([])
const baseModels = ref<SelectOption[]>([])
const sortBy = ref<SortOption>('recent')
const ownership = ref<OwnershipOption>('all')

const { availableFileFormats, availableBaseModels } =
  useAssetFilterOptions(assets)

const hasMutableAssets = computed(() => {
  const assetsToCheck = allAssets.length ? allAssets : assets
  return assetsToCheck.some((asset) => asset.is_immutable === false)
})

const emit = defineEmits<{
  filterChange: [filters: FilterState]
}>()

function handleFilterChange() {
  emit('filterChange', {
    fileFormats: fileFormats.value.map((option: SelectOption) => option.value),
    baseModels: baseModels.value.map((option: SelectOption) => option.value),
    sortBy: sortBy.value,
    ownership: ownership.value
  })
}
</script>
