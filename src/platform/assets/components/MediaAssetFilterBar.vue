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
      <Toggle
        v-if="showTabToggle"
        v-tooltip.top="
          activeTab === 'output'
            ? $t('sideToolbar.mediaAssets.switchToImported')
            : $t('sideToolbar.mediaAssets.switchToGenerated')
        "
        :model-value="activeTab === 'input'"
        :data-active-tab="activeTab"
        data-testid="assets-tab-toggle"
        :aria-label="
          activeTab === 'output'
            ? $t('sideToolbar.mediaAssets.switchToImported')
            : $t('sideToolbar.mediaAssets.switchToGenerated')
        "
        class="text-secondary-foreground focus-visible:ring-ring inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-none bg-secondary-background transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none"
        @update:model-value="
          (pressed: boolean) => (activeTab = pressed ? 'input' : 'output')
        "
      >
        <i
          :class="
            activeTab === 'output'
              ? 'icon-[lucide--sparkles] size-4'
              : 'icon-[lucide--folder-input] size-4'
          "
        />
      </Toggle>
      <MediaAssetFilterButton
        v-if="isCloud"
        v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
      >
        <template #default="{ close }">
          <MediaAssetFilterMenu
            :media-type-filters
            :close
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
import { Toggle } from 'reka-ui'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const {
  showGenerationTimeSort = false,
  bottomDivider = false,
  showTabToggle = false
} = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
  bottomDivider?: boolean
  showTabToggle?: boolean
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
}>()

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })
const activeTab = defineModel<'input' | 'output'>('activeTab')

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}
</script>
