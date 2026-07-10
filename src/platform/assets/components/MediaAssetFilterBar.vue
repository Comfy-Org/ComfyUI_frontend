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
          v-model:visibility-filter="visibilityFilter"
          v-model:author-filter="authorFilter"
          v-model:date-filter="dateFilter"
          :author-options
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

import { AUTHOR_ME } from '../composables/useAssetSharing'
import type { VisibilityFilter } from '../composables/useMediaAssetFiltering'
import {
  DATE_VALUES,
  MEDIA_TYPE_VALUES,
  VISIBILITY_VALUES,
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

const {
  showGenerationTimeSort = false,
  bottomDivider = false,
  authorOptions = []
} = defineProps<{
  showGenerationTimeSort?: boolean
  authorOptions?: string[]
  bottomDivider?: boolean
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<MediaAssetViewMode>('viewMode', { required: true })
const visibilityFilter = defineModel<VisibilityFilter>('visibilityFilter', {
  required: true
})
const authorFilter = defineModel<string>('authorFilter', { required: true })
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
  if (authorFilter.value) {
    chips.push({
      key: 'author',
      label:
        authorFilter.value === AUTHOR_ME
          ? t('sideToolbar.mediaAssets.authorMe')
          : authorFilter.value
    })
  }
  if (visibilityFilter.value !== 'all') {
    chips.push({
      key: 'visibility',
      label: t(
        labelKeyForValue(VISIBILITY_VALUES, visibilityFilter.value) ??
          visibilityFilter.value
      )
    })
  }
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
  if (key === 'visibility') {
    visibilityFilter.value = 'all'
    return
  }
  if (key === 'author') {
    authorFilter.value = ''
    return
  }
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
  visibilityFilter.value = 'all'
  authorFilter.value = ''
  dateFilter.value = ''
  mediaTypeFilters.value = []
}
</script>
