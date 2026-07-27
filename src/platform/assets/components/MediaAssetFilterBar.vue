<template>
  <SidebarTopArea :bottom-divider>
    <SearchInput
      :model-value="searchQuery"
      :placeholder="
        $t('g.searchPlaceholder', { subject: $t('sideToolbar.labels.assets') })
      "
      @update:model-value="handleSearchChange"
    />
    <template #actions>
      <MediaAssetFilterButton
        v-if="isCloud"
        v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
      >
        <template #default>
          <MediaAssetFilterMenu
            :date-filter
            :media-type-filters
            @update:date-filter="handleDateFilterChange"
            @update:media-type-filters="handleMediaTypeFiltersChange"
          />
        </template>
      </MediaAssetFilterButton>
      <MediaAssetSettingsButton
        v-tooltip.top="{ value: $t('sideToolbar.mediaAssets.viewSettings') }"
      >
        <template #default>
          <MediaAssetSettingsMenu
            v-model:view-mode="viewMode"
            v-model:sort-by="sortBy"
            :show-sort-options="isCloud"
            :show-generation-time-sort
          />
        </template>
      </MediaAssetSettingsButton>
    </template>
  </SidebarTopArea>
</template>

<script setup lang="ts">
import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const { showGenerationTimeSort = false, bottomDivider = false } = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  dateFilter: MediaAssetDateFilter
  mediaTypeFilters: string[]
  bottomDivider?: boolean
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:dateFilter': [value: MediaAssetDateFilter]
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

const handleDateFilterChange = (value: MediaAssetDateFilter) => {
  emit('update:dateFilter', value)
}
</script>
