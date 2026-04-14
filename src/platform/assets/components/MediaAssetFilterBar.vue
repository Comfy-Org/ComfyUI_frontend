<template>
  <SidebarTopArea :bottom-divider>
    <div class="flex items-center gap-2">
      <slot name="prefix" />
      <SearchInputWithTags
        ref="searchRef"
        v-model="selectedChips"
        v-model:query="searchModel"
        :suggestions="allSuggestions"
        :allow-create="false"
        :chip-class="getChipClass"
        :chip-label="getChipLabel"
        :placeholder="
          $t('g.searchPlaceholder', {
            subject: $t('sideToolbar.labels.assets')
          })
        "
        class="min-w-0 flex-1"
      >
        <template #suggestion="{ suggestion }">
          <span class="text-muted-foreground italic opacity-90">
            {{ getSuggestionPrefix(suggestion) }}
          </span>
          <span
            :class="
              cn(
                'ml-1.5 inline-flex items-center rounded-sm px-2 py-0.5 text-xs',
                getSuggestionPillClass(suggestion)
              )
            "
          >
            {{ stripPrefix(suggestion) }}
          </span>
        </template>
      </SearchInputWithTags>
    </div>
    <template #actions>
      <MediaAssetFilterButton
        v-if="isCloud || (suggestions && suggestions.length > 0)"
        v-tooltip.top="{ value: $t('assetBrowser.filterBy') }"
      >
        <template #default>
          <MediaAssetFilterMenu
            :media-type-filters
            :tag-suggestions="suggestions ?? []"
            :selected-tags="activeTagFilters"
            @update:media-type-filters="handleMediaTypeFiltersChange"
            @update:selected-tags="handleTagFiltersChange"
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
import { computed, ref, watch } from 'vue'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import SearchInputWithTags from '@/components/ui/search-input/SearchInputWithTags.vue'
import { isCloud } from '@/platform/distribution/types'
import { cn } from '@/utils/tailwindUtil'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const MEDIA_TYPES = ['image', 'video', 'audio', '3d', 'text']

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
  suggestions?: string[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
}>()

const filterTags = defineModel<string[]>('filterTags', { default: () => [] })

const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

const searchRef = ref<InstanceType<typeof SearchInputWithTags>>()

const searchModel = computed({
  get: () => searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

// Combined suggestions: tag:* + type:*
const allSuggestions = computed(() => {
  const tagSuggs = (suggestions ?? []).map((t) => `tag:${t}`)
  const typeSuggs = MEDIA_TYPES.map((t) => `type:${t}`)
  return [...tagSuggs, ...typeSuggs]
})

// Single source of truth: all selected chips as prefixed strings
const selectedChips = ref<string[]>([])

// Sync chips → filterTags + mediaTypeFilters
watch(
  selectedChips,
  (chips) => {
    filterTags.value = chips
      .filter((c) => c.startsWith('tag:'))
      .map((c) => c.slice(4))

    emit(
      'update:mediaTypeFilters',
      chips.filter((c) => c.startsWith('type:')).map((c) => c.slice(5))
    )
  },
  { deep: true }
)

// Prefix helpers
function stripPrefix(value: string): string {
  const idx = value.indexOf(':')
  return idx >= 0 ? value.slice(idx + 1) : value
}

function getSuggestionPrefix(value: string): string {
  if (value.startsWith('type:')) return 'type:'
  return 'tag:'
}

function getSuggestionPillClass(value: string): string {
  if (value.startsWith('type:'))
    return 'bg-primary/15 text-primary border border-primary/30'
  return 'bg-modal-card-tag-background text-modal-card-tag-foreground'
}

function getChipClass(value: string): string {
  if (value.startsWith('type:'))
    return 'bg-primary/15 text-primary border-primary/30'
  return ''
}

function getChipLabel(value: string): string {
  return stripPrefix(value)
}

function focus() {
  searchRef.value?.focus()
}

defineExpose({ focus })

// Derived: raw tag names from selected chips (for filter menu)
const activeTagFilters = computed(() =>
  selectedChips.value.filter((c) => c.startsWith('tag:')).map((c) => c.slice(4))
)

const handleMediaTypeFiltersChange = (value: string[]) => {
  // Sync checkbox filter → chips (rebuild type chips, keep tag chips)
  const tagChips = selectedChips.value.filter((c) => c.startsWith('tag:'))
  const typeChips = value.map((t) => `type:${t}`)
  selectedChips.value = [...tagChips, ...typeChips]
}

function handleTagFiltersChange(value: string[]) {
  // Sync tag checkboxes → chips (rebuild tag chips, keep type chips)
  const typeChips = selectedChips.value.filter((c) => c.startsWith('type:'))
  const tagChips = value.map((t) => `tag:${t}`)
  selectedChips.value = [...tagChips, ...typeChips]
}
</script>
