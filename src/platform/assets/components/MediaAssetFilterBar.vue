<template>
  <div>
    <SidebarTopArea>
      <MediaAssetSearchField
        :model-value="searchQuery"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
        @update:model-value="handleSearchChange"
      />
      <template #actions>
        <MediaAssetFilterMenu
          v-if="isCloud"
          v-model:visibility-filter="visibilityFilter"
          v-model:author-filter="authorFilter"
          v-model:date-filter="dateFilter"
          :media-type-filters
          :author-options
          :active="hasActiveFilters"
          @update:media-type-filters="handleMediaTypeFiltersChange"
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
  mediaTypeFilters,
  authorOptions = []
} = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
  authorOptions?: string[]
  bottomDivider?: boolean
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
}>()

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<MediaAssetViewMode>('viewMode', { required: true })
const visibilityFilter = defineModel<VisibilityFilter>('visibilityFilter', {
  required: true
})
const authorFilter = defineModel<string>('authorFilter', { required: true })
const dateFilter = defineModel<string>('dateFilter', { required: true })

const { t } = useI18n()

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'sideToolbar.mediaAssets.filterImage',
  video: 'sideToolbar.mediaAssets.filterVideo',
  audio: 'sideToolbar.mediaAssets.filterAudio',
  '3d': 'sideToolbar.mediaAssets.filter3D',
  text: 'sideToolbar.mediaAssets.filterText'
}

const VISIBILITY_LABELS: Record<Exclude<VisibilityFilter, 'all'>, string> = {
  shared: 'sideToolbar.mediaAssets.visibilityShared',
  private: 'sideToolbar.mediaAssets.visibilityPrivate'
}

const DATE_LABELS: Record<string, string> = {
  today: 'sideToolbar.mediaAssets.dateToday',
  week: 'sideToolbar.mediaAssets.datePastWeek',
  month: 'sideToolbar.mediaAssets.datePastMonth',
  year: 'sideToolbar.mediaAssets.dateThisYear'
}

const filterChips = computed<FilterChipDescriptor[]>(() => {
  const chips: FilterChipDescriptor[] = mediaTypeFilters.map((type) => ({
    key: `media:${type}`,
    label: t(MEDIA_TYPE_LABELS[type] ?? type)
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
      label: t(VISIBILITY_LABELS[visibilityFilter.value])
    })
  }
  if (dateFilter.value) {
    chips.push({
      key: 'date',
      label: t(DATE_LABELS[dateFilter.value] ?? dateFilter.value)
    })
  }
  return chips
})

const hasActiveFilters = computed(() => filterChips.value.length > 0)

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}

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
  emit(
    'update:mediaTypeFilters',
    mediaTypeFilters.filter((value) => value !== type)
  )
}

function clearAllFilters() {
  visibilityFilter.value = 'all'
  authorFilter.value = ''
  dateFilter.value = ''
  emit('update:mediaTypeFilters', [])
}
</script>
