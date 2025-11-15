<template>
  <div class="flex gap-3 pt-2">
    <SearchBox
      :model-value="searchQuery"
      :placeholder="$t('sideToolbar.searchAssets')"
      size="lg"
      @update:model-value="handleSearchChange"
    />
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
import SearchBox from '@/components/input/SearchBox.vue'
import { isCloud } from '@/platform/distribution/types'

import AssetSortButton from './MediaAssetSortButton.vue'
import MediaAssetSortMenu from './MediaAssetSortMenu.vue'

const { showGenerationTimeSort = false } = defineProps<{
  searchQuery: string
  sortBy: 'newest' | 'oldest' | 'longest' | 'fastest'
  showGenerationTimeSort?: boolean
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:sortBy': [value: 'newest' | 'oldest' | 'longest' | 'fastest']
}>()

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleSortChange = (
  value: 'newest' | 'oldest' | 'longest' | 'fastest'
) => {
  emit('update:sortBy', value)
}
</script>
