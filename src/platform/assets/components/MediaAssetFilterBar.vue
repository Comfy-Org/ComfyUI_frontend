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
    <div
      class="inline-flex items-center gap-1 rounded-lg bg-secondary-background p-1"
      role="group"
    >
      <Button
        type="button"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('sideToolbar.queueProgressOverlay.viewList')"
        :aria-pressed="viewMode === 'list'"
        :class="
          cn(
            'rounded-lg',
            viewMode === 'list'
              ? 'bg-secondary-background-selected text-text-primary hover:bg-secondary-background-selected'
              : 'text-text-secondary hover:bg-secondary-background-hover'
          )
        "
        @click="viewMode = 'list'"
      >
        <i class="icon-[lucide--table-of-contents] size-4" />
      </Button>
      <Button
        type="button"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('sideToolbar.queueProgressOverlay.viewGrid')"
        :aria-pressed="viewMode === 'grid'"
        :class="
          cn(
            'rounded-lg',
            viewMode === 'grid'
              ? 'bg-secondary-background-selected text-text-primary hover:bg-secondary-background-selected'
              : 'text-text-secondary hover:bg-secondary-background-hover'
          )
        "
        @click="viewMode = 'grid'"
      >
        <i class="icon-[lucide--layout-grid] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import SearchBox from '@/components/common/SearchBox.vue'
import Button from '@/components/ui/button/Button.vue'
import { isCloud } from '@/platform/distribution/types'
import { cn } from '@/utils/tailwindUtil'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import AssetSortButton from './MediaAssetSortButton.vue'
import MediaAssetSortMenu from './MediaAssetSortMenu.vue'
import type { SortBy } from './MediaAssetSortMenu.vue'

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
