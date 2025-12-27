<template>
  <div class="flex gap-3">
    <SearchBox
      :model-value="searchQuery"
      :placeholder="$t('sideToolbar.searchAssets') + '...'"
      @update:model-value="handleSearchChange"
    />
    <MediaAssetFilterButton
      v-if="isCloud"
      v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
      size="md"
    >
      <template #default="{ close }">
        <MediaAssetFilterMenu
          :media-type-filters="mediaTypeFilters"
          :close="close"
          @update:media-type-filters="handleMediaTypeFiltersChange"
        />
      </template>
    </MediaAssetFilterButton>
    <AssetSortButton
      v-if="isCloud"
      v-tooltip.top="{ value: $t('assetBrowser.sortBy') }"
      size="md"
    >
      <template #default="{ close }">
        <MediaAssetSortMenu
          v-model:sort-by="sortBy"
          :show-generation-time-sort
          :close="close"
        />
      </template>
    </AssetSortButton>
    <MediaAssetViewModeToggle
      v-if="isQPOV2Enabled"
      v-model:view-mode="viewMode"
    />
  </div>
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import { isQPOV2Enabled } from '@/config/uiFeatureFlags'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import AssetSortButton from './MediaAssetSortButton.vue'
import MediaAssetSortMenu from './MediaAssetSortMenu.vue'
import type { SortBy } from './MediaAssetSortMenu.vue'
import MediaAssetViewModeToggle from './MediaAssetViewModeToggle.vue'

const { showGenerationTimeSort = false } = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
}>()

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}
</script>
