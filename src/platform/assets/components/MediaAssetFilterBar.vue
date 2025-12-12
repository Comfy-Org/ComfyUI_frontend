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
          :sort-by="sortBy"
          :show-generation-time-sort
          :close="close"
          @update:sort-by="handleSortChange"
        />
      </template>
    </AssetSortButton>
  </div>
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import AssetSortButton from './MediaAssetSortButton.vue'
import MediaAssetSortMenu from './MediaAssetSortMenu.vue'

const { showGenerationTimeSort = false } = defineProps<{
  searchQuery: string
  sortBy: 'newest' | 'oldest' | 'longest' | 'fastest'
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:sortBy': [value: 'newest' | 'oldest' | 'longest' | 'fastest']
  'update:mediaTypeFilters': [value: string[]]
}>()

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleSortChange = (
  value: 'newest' | 'oldest' | 'longest' | 'fastest'
) => {
  emit('update:sortBy', value)
}

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}
</script>
