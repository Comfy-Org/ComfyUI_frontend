<template>
  <div class="flex gap-3 items-center">
    <SearchBox
      :model-value="searchQuery"
      :placeholder="
        $t('g.searchPlaceholder', { subject: $t('sideToolbar.labels.assets') })
      "
      @update:model-value="handleSearchChange"
    />
    <div class="flex gap-1.5 items-center">
      <MediaAssetFilterButton
        v-if="isCloud"
        v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
        size="md"
      >
        <template #default="{ close }">
          <MediaAssetFilterMenu
            :media-type-filters
            :close
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
            :close
          />
        </template>
      </AssetSortButton>
      <MediaAssetSettingsButton
        v-tooltip.top="{ value: $t('sideToolbar.mediaAssets.viewSettings') }"
      >
        <template #default="{ close }">
          <MediaAssetSettingsMenu v-model:view-mode="viewMode" :close />
        </template>
      </MediaAssetSettingsButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import AssetSortButton from './MediaAssetSortButton.vue'
import MediaAssetSortMenu from './MediaAssetSortMenu.vue'
import type { SortBy } from './MediaAssetSortMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'

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
