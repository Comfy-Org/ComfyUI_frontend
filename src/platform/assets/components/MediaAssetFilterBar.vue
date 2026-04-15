<template>
  <SidebarTopArea :bottom-divider>
    <div class="flex items-center gap-2">
      <slot name="prefix" />
      <SearchInputWithTags
        ref="searchRef"
        v-model="selectedChips"
        v-model:query="searchModel"
        :suggestions="allSuggestions"
        :allow-create="true"
        :can-create="canCreateChip"
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
            {{ getChipLabel(suggestion) || stripPrefix(suggestion) }}
          </span>
        </template>
        <template #create="{ value }">
          <template v-if="value.startsWith('prop:')">
            <span class="italic opacity-90">{{ $t('g.filter') }}:</span>
            <span
              class="ml-2 inline-flex items-center rounded-sm border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600"
            >
              {{ getChipLabel(value) }}
            </span>
          </template>
          <template v-else>
            <span class="italic opacity-90">{{ $t('g.search') }}:</span>
            <span
              class="ml-2 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
            >
              {{ value }}
            </span>
          </template>
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
import { computed, nextTick, ref, watch } from 'vue'

import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import SearchInputWithTags from '@/components/ui/search-input/SearchInputWithTags.vue'
import { parsePropFilter } from '@/platform/assets/composables/useMediaAssetFiltering'
import type { PropertySuggestion } from '@/platform/assets/schemas/userPropertySchema'
import { isCloud } from '@/platform/distribution/types'
import { cn } from '@/utils/tailwindUtil'

import MediaAssetFilterButton from './MediaAssetFilterButton.vue'
import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'
import MediaAssetSettingsButton from './MediaAssetSettingsButton.vue'
import MediaAssetSettingsMenu from './MediaAssetSettingsMenu.vue'
import type { SortBy } from './MediaAssetSettingsMenu.vue'

const MEDIA_TYPES = ['image', 'video', 'audio', '3d', 'text']
const NUMBER_OPS = ['>', '<', '>=', '<=', '=']
const STRING_OPS = ['~', '=']

const {
  searchQuery,
  showGenerationTimeSort = false,
  bottomDivider = false,
  suggestions,
  propertySuggestions
} = defineProps<{
  searchQuery: string
  showGenerationTimeSort?: boolean
  mediaTypeFilters: string[]
  bottomDivider?: boolean
  suggestions?: string[]
  propertySuggestions?: Map<string, PropertySuggestion>
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:mediaTypeFilters': [value: string[]]
  'update:propertyFilters': [
    value: { key: string; op: string; target: string }[]
  ]
}>()

const filterTags = defineModel<string[]>('filterTags', { default: () => [] })
const sortBy = defineModel<SortBy>('sortBy', { required: true })
const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

const searchRef = ref<InstanceType<typeof SearchInputWithTags>>()

const searchModel = computed({
  get: () => searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

// Context-aware suggestions
const allSuggestions = computed(() => {
  const tagSuggs = (suggestions ?? []).map((t) => `tag:${t}`)
  const typeSuggs = MEDIA_TYPES.map((t) => `type:${t}`)
  const baseSuggs = [...tagSuggs, ...typeSuggs]

  const propMap = propertySuggestions
  if (!propMap || propMap.size === 0) return baseSuggs

  const q = searchModel.value
  if (!q.startsWith('prop:')) {
    return [...baseSuggs, ...[...propMap.keys()].map((k) => `prop:${k}`)]
  }

  const afterProp = q.slice(5)
  const matchedKey = [...propMap.keys()].find(
    (k) => afterProp === k || afterProp.startsWith(k)
  )
  if (!matchedKey) {
    return [...propMap.keys()]
      .filter((k) => k.startsWith(afterProp))
      .map((k) => `prop:${k}`)
  }

  const afterKey = afterProp.slice(matchedKey.length)
  const type = propMap.get(matchedKey)?.type ?? 'string'
  if (afterKey === '') {
    if (type === 'boolean')
      return [`prop:${matchedKey}=true`, `prop:${matchedKey}=false`]
    return (type === 'number' ? NUMBER_OPS : STRING_OPS).map(
      (op) => `prop:${matchedKey}${op}`
    )
  }
  if (type === 'boolean' && afterKey === '=')
    return [`prop:${matchedKey}=true`, `prop:${matchedKey}=false`]
  return []
})

const selectedChips = ref<string[]>([])

// Sync chips → filterTags + mediaTypeFilters + propertyFilters
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
    emit(
      'update:propertyFilters',
      chips
        .filter((c) => c.startsWith('prop:'))
        .map(parsePropFilter)
        .filter((f): f is NonNullable<typeof f> => f !== null)
    )
  },
  { deep: true }
)

// Intercept incomplete prop: chips — redirect back to query
watch(selectedChips, (newChips, oldChips) => {
  if (!oldChips) return
  const added = newChips.filter((c) => !oldChips.includes(c))
  const incomplete = added.find(
    (c) => c.startsWith('prop:') && !parsePropFilter(c)
  )
  if (incomplete) {
    selectedChips.value = newChips.filter((c) => c !== incomplete)
    void nextTick(() => {
      searchModel.value = incomplete
      void nextTick(() => {
        searchRef.value?.focus()
        searchRef.value?.openDropdown()
      })
    })
  }
})

function stripPrefix(value: string): string {
  const idx = value.indexOf(':')
  return idx >= 0 ? value.slice(idx + 1) : value
}

function getSuggestionPrefix(value: string): string {
  if (value.startsWith('type:')) return 'type:'
  if (value.startsWith('prop:')) return 'prop:'
  return 'tag:'
}

function getSuggestionPillClass(value: string): string {
  if (value.startsWith('type:'))
    return 'bg-primary/15 text-primary border border-primary/30'
  if (value.startsWith('prop:'))
    return 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
  return 'bg-modal-card-tag-background text-modal-card-tag-foreground'
}

function getChipClass(value: string): string {
  if (value.startsWith('type:'))
    return 'bg-primary/15 text-primary border-primary/30'
  if (value.startsWith('prop:'))
    return 'bg-amber-500/15 text-amber-600 border-amber-500/30'
  return ''
}

function getChipLabel(value: string): string {
  if (value.startsWith('prop:')) {
    const parsed = parsePropFilter(value)
    if (parsed) {
      const op = parsed.op === '~' ? 'contains' : parsed.op
      return `${parsed.key} ${op} ${parsed.target}`
    }
  }
  return stripPrefix(value)
}

function canCreateChip(value: string): boolean {
  if (value.startsWith('prop:')) return !!parsePropFilter(value)
  return true
}

function focus() {
  searchRef.value?.focus()
}

defineExpose({ focus })

watch(filterTags, (tags) => {
  const currentTagChips = selectedChips.value
    .filter((c) => c.startsWith('tag:'))
    .map((c) => c.slice(4))
  const tagsMatch =
    tags.length === currentTagChips.length &&
    tags.every((t) => currentTagChips.includes(t))
  if (!tagsMatch) {
    const nonTagChips = selectedChips.value.filter((c) => !c.startsWith('tag:'))
    selectedChips.value = [...tags.map((t) => `tag:${t}`), ...nonTagChips]
  }
})

const activeTagFilters = computed(() =>
  selectedChips.value.filter((c) => c.startsWith('tag:')).map((c) => c.slice(4))
)

const handleMediaTypeFiltersChange = (value: string[]) => {
  const nonTypeChips = selectedChips.value.filter((c) => !c.startsWith('type:'))
  selectedChips.value = [...nonTypeChips, ...value.map((t) => `type:${t}`)]
}

function handleTagFiltersChange(value: string[]) {
  const nonTagChips = selectedChips.value.filter((c) => !c.startsWith('tag:'))
  selectedChips.value = [...value.map((t) => `tag:${t}`), ...nonTagChips]
}
</script>
