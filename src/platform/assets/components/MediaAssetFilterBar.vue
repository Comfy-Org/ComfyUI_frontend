<template>
  <div>
    <SidebarTopArea>
      <MediaAssetSearchField
        v-model="searchQuery"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
      />
      <template #actions>
        <MediaAssetFilterMenu
          v-if="isCloud"
          v-model:media-type-filters="mediaTypeFilters"
          v-model:date-filter="dateFilter"
          :active="hasActiveFilters"
        />
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

    <MediaAssetFilterChips
      v-if="filterChips.length"
      :chips="filterChips"
      class="px-2 pb-2 2xl:px-4"
      @remove="removeChip"
      @clear="clearAllFilters"
    />

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
import { isCloud } from '@/platform/distribution/types'

import {
  DATE_VALUES,
  MEDIA_TYPE_VALUES,
  labelKeyForValue
} from './mediaAssetFilterFacets'
import type { MediaAssetViewMode } from './mediaAssetViewOptions'
import type { FilterChipDescriptor } from './MediaAssetFilterChips.vue'
import MediaAssetFilterChips from './MediaAssetFilterChips.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSearchField from './MediaAssetSearchField.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const { showGenerationTimeSort = false, bottomDivider = false } = defineProps<{
  showGenerationTimeSort?: boolean
  bottomDivider?: boolean
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<MediaAssetViewMode>('viewMode', { required: true })
const dateFilter = defineModel<string>('dateFilter', { required: true })
const mediaTypeFilters = defineModel<string[]>('mediaTypeFilters', {
  required: true
})

const { t } = useI18n()

const filterChips = computed<FilterChipDescriptor[]>(() => {
  const chips: FilterChipDescriptor[] = mediaTypeFilters.value.map((type) => ({
    key: `media:${type}`,
    label: t(labelKeyForValue(MEDIA_TYPE_VALUES, type) ?? type)
  }))
  if (dateFilter.value) {
    chips.push({
      key: 'date',
      label: t(
        labelKeyForValue(DATE_VALUES, dateFilter.value) ?? dateFilter.value
      )
    })
  }
  return chips
})

const hasActiveFilters = computed(() => filterChips.value.length > 0)

function removeChip(key: string) {
  if (key === 'date') {
    dateFilter.value = ''
    return
  }
  const type = key.slice('media:'.length)
  mediaTypeFilters.value = mediaTypeFilters.value.filter(
    (value) => value !== type
  )
}

function clearAllFilters() {
  dateFilter.value = ''
  mediaTypeFilters.value = []
}
</script>
