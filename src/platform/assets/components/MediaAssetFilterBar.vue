<template>
  <div>
    <SidebarTopArea>
      <SearchInput
        v-model="searchQuery"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
      />
      <template #actions>
        <Menu v-if="isCloud" :modal="false">
          <template #trigger>
            <Button
              :tooltip="$t('assetBrowser.filterBy')"
              variant="secondary"
              size="icon"
              icon="icon-[lucide--list-filter]"
              :indicator="hasActiveFilters"
              :aria-label="$t('assetBrowser.filterBy')"
            />
          </template>
          <MediaAssetFilterMenu
            v-model:date-filter="dateFilter"
            v-model:media-type-filters="mediaTypeFilters"
          />
        </Menu>
        <MediaAssetSettingsButton>
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
      class="flex flex-wrap items-center gap-1.5 px-4 pb-2"
    >
      <span
        v-for="chip in filterChips"
        :key="chip.key"
        class="inline-flex items-center gap-1 rounded-md bg-secondary-background py-1 pr-1 pl-2 text-xs whitespace-nowrap"
      >
        <span>{{ chip.label }}</span>
        <Button
          variant="textonly"
          size="icon"
          class="size-4 rounded-sm p-0"
          :aria-label="
            $t('sideToolbar.mediaAssets.removeFilter', {
              label: chip.label
            })
          "
          @click="removeFilter(chip.key)"
        >
          <i class="icon-[lucide--x] size-3" />
        </Button>
      </span>
      <Button
        variant="textonly"
        class="h-6 px-1.5 text-xs text-muted-foreground"
        @click="clearFilters"
      >
        {{ $t('sideToolbar.mediaAssets.clearFilters') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'
import {
  dateFilterOptions,
  mediaTypeFilterOptions
} from '@/platform/assets/mediaAssetFilterOptions'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'
import type { MediaAssetViewMode } from './mediaAssetViewOptions'

const { showGenerationTimeSort = false } = defineProps<{
  showGenerationTimeSort?: boolean
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<MediaAssetViewMode>('viewMode', { required: true })
const dateFilter = defineModel<MediaAssetDateFilter>('dateFilter', {
  required: true
})
const mediaTypeFilters = defineModel<string[]>('mediaTypeFilters', {
  required: true
})

const { t } = useI18n()

function labelFor(options: { value: string; label: string }[], value: string) {
  return t(options.find((option) => option.value === value)?.label ?? value)
}

const filterChips = computed(() => {
  const chips = mediaTypeFilters.value.map((value) => ({
    key: `media:${value}`,
    label: labelFor(mediaTypeFilterOptions, value)
  }))

  if (dateFilter.value) {
    chips.push({
      key: 'date',
      label: labelFor(dateFilterOptions, dateFilter.value)
    })
  }

  return chips
})

const hasActiveFilters = computed(() => filterChips.value.length > 0)

function removeFilter(key: string) {
  if (key === 'date') {
    dateFilter.value = ''
    return
  }

  const mediaType = key.slice('media:'.length)
  mediaTypeFilters.value = mediaTypeFilters.value.filter(
    (value) => value !== mediaType
  )
}

function clearFilters() {
  dateFilter.value = ''
  mediaTypeFilters.value = []
}
</script>
