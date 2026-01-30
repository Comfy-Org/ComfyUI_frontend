<template>
  <div
    class="flex gap-4 items-center justify-between px-6 pt-2 pb-6"
    data-component-id="asset-filter-bar"
  >
    <div
      class="flex gap-4 items-center"
      data-component-id="asset-filter-bar-left"
    >
      <SingleSelect
        v-if="showOwnershipFilter"
        v-model="ownership"
        :label="$t('assetBrowser.ownership')"
        :options="ownershipOptions"
        class="min-w-32"
        data-component-id="asset-filter-ownership"
        @update:model-value="handleFilterChange"
      />

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
          <i class="icon-[lucide--arrow-up-down]" />
        </template>
      </SingleSelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MultiSelect from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import type { SelectOption } from '@/components/input/types'
import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const { t } = useI18n()

type SortOption = 'recent' | 'name-asc' | 'name-desc'
export type OwnershipOption = 'all' | 'my-models' | 'public-models'

const sortOptions = computed(() => [
  { name: t('assetBrowser.sortRecent'), value: 'recent' as const },
  { name: t('assetBrowser.sortAZ'), value: 'name-asc' as const },
  { name: t('assetBrowser.sortZA'), value: 'name-desc' as const }
])

const ownershipOptions = computed(() => [
  { name: t('assetBrowser.ownershipAll'), value: 'all' as const },
  { name: t('assetBrowser.ownershipMyModels'), value: 'my-models' as const },
  {
    name: t('assetBrowser.ownershipPublicModels'),
    value: 'public-models' as const
  }
])

export interface FilterState {
  fileFormats: string[]
  baseModels: string[]
  sortBy: SortOption
  ownership: OwnershipOption
}

const { assets = [], showOwnershipFilter = false } = defineProps<{
  assets?: AssetItem[]
  showOwnershipFilter?: boolean
}>()

const fileFormats = ref<SelectOption[]>([])
const baseModels = ref<SelectOption[]>([])
const sortBy = ref<SortOption>('recent')
const ownership = ref<OwnershipOption>('all')

const { availableFileFormats, availableBaseModels } = useAssetFilterOptions(
  () => assets
)

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
