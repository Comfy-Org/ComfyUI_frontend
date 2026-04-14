<template>
  <SidebarTopArea :bottom-divider>
    <div class="flex items-center gap-2">
      <slot name="prefix" />
      <TagsInputAutocomplete
        v-if="suggestions && suggestions.length > 0"
        ref="tagSearchRef"
        v-model="filterTags"
        v-model:query="searchModel"
        :suggestions
        :allow-create="false"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
        class="min-w-0 flex-1"
      >
        <template #suggestion="{ suggestion }">
          <span class="text-muted-foreground italic opacity-90">
            {{ $t('g.tagPrefix') }}
          </span>
          <span
            class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
          >
            {{ suggestion }}
          </span>
        </template>
      </TagsInputAutocomplete>
      <SearchInput
        v-else
        ref="searchInputRef"
        :model-value="searchQuery"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
        class="min-w-0 flex-1"
        @update:model-value="handleSearchChange"
      />
    </div>
    <template #actions>
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
import { computed, ref } from 'vue'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import TagsInputAutocomplete from '@/components/ui/tags-input/TagsInputAutocomplete.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { isCloud } from '@/platform/distribution/types'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const {
  searchQuery,
  showGenerationTimeSort = false,
  bottomDivider = false,
  suggestions
} = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
  bottomDivider?: boolean
  /** When provided, search field shows tag autocomplete with chip filters */
  suggestions?: string[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
}>()

const filterTags = defineModel<string[]>('filterTags', { default: () => [] })

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

const searchInputRef = ref()
const tagSearchRef = ref()

// Two-way binding for TagsInputAutocomplete query
const searchModel = computed({
  get: () => searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

function focus() {
  searchInputRef.value?.focus()
  tagSearchRef.value?.$el?.querySelector('input')?.focus()
}

defineExpose({ focus })

const handleSearchChange = (value: string | undefined) => {
  emit('update:searchQuery', value ?? '')
}

const handleMediaTypeFiltersChange = (value: string[]) => {
  emit('update:mediaTypeFilters', value)
}
</script>
