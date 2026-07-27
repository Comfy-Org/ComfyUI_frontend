<template>
  <div>
    <SidebarTopArea>
      <SearchInput
        :model-value="searchQuery"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
        @update:model-value="handleSearchChange"
      />
      <template #actions>
        <MediaAssetFilterButton
          v-if="isCloud"
          v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
          :active="hasActiveFilters"
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

    <div
      v-if="filterChips.length"
      class="flex flex-wrap items-center gap-1.5 px-2 pb-2 2xl:px-4"
    >
      <MediaAssetFilterChip
        v-for="chip in filterChips"
        :key="chip.key"
        :label="chip.label"
        @remove="removeFilter(chip.key)"
      />
      <Button
        variant="textonly"
        class="h-6 px-1.5 text-xs text-muted-foreground"
        @click="clearFilters"
      >
        {{ $t('sideToolbar.mediaAssets.clearFilters') }}
      </Button>
    </div>

    <div
      v-if="bottomDivider"
      class="border-t border-dashed border-comfy-input"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'
import {
  dateFilterOptions,
  mediaTypeFilterOptions
} from '@/platform/assets/mediaAssetFilterOptions'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterChip from './MediaAssetFilterChip.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const {
  showGenerationTimeSort = false,
  bottomDivider = false,
  dateFilter,
  mediaTypeFilters
} = defineProps<{
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

const { t } = useI18n()

function labelFor(options: { value: string; label: string }[], value: string) {
  return t(options.find((option) => option.value === value)?.label ?? value)
}

const filterChips = computed(() => {
  const chips = mediaTypeFilters.map((value) => ({
    key: `media:${value}`,
    label: labelFor(mediaTypeFilterOptions, value)
  }))

  if (dateFilter) {
    chips.push({
      key: 'date',
      label: labelFor(dateFilterOptions, dateFilter)
    })
  }

  return chips
})

const hasActiveFilters = computed(() => filterChips.value.length > 0)

function handleSearchChange(value: string | undefined) {
  emit('update:searchQuery', value ?? '')
}

function handleMediaTypeFiltersChange(value: string[]) {
  emit('update:mediaTypeFilters', value)
}

function handleDateFilterChange(value: MediaAssetDateFilter) {
  emit('update:dateFilter', value)
}

function removeFilter(key: string) {
  if (key === 'date') {
    emit('update:dateFilter', '')
    return
  }

  const mediaType = key.slice('media:'.length)
  emit(
    'update:mediaTypeFilters',
    mediaTypeFilters.filter((value) => value !== mediaType)
  )
}

function clearFilters() {
  emit('update:dateFilter', '')
  emit('update:mediaTypeFilters', [])
}
</script>
