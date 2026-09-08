<template>
  <div class="flex h-8 items-center gap-2 px-2">
    <i
      aria-hidden="true"
      class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
    />
    <input
      ref="searchInput"
      v-model="searchQuery"
      type="text"
      :aria-label="$t('assetBrowser.filterBy')"
      :placeholder="$t('sideToolbar.mediaAssets.filterBy')"
      class="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      @keydown="handleSearchKeydown"
    />
  </div>
  <DropdownMenuSeparator class="my-1 h-px bg-border-subtle" />

  <template v-if="isSearching">
    <template v-if="matchingMediaTypes.length">
      <DropdownMenuLabel :class="groupLabelClass">
        {{ $t('sideToolbar.mediaAssets.filterMediaType') }}
      </DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        v-for="filter in matchingMediaTypes"
        :key="filter.value"
        :model-value="mediaTypeFilters.includes(filter.value)"
        :class="menuItemClass"
        @click="toggleMediaType(filter.value)"
        @keydown="handleSearchResultKeydown"
        @select.prevent
      >
        <span class="flex-1">{{ $t(filter.label) }}</span>
        <DropdownMenuItemIndicator class="size-4 shrink-0">
          <i class="icon-[lucide--check]" />
        </DropdownMenuItemIndicator>
      </DropdownMenuCheckboxItem>
    </template>

    <template v-if="matchingDates.length">
      <DropdownMenuLabel :class="groupLabelClass">
        {{ $t('sideToolbar.mediaAssets.filterDate') }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="dateFilter">
        <DropdownMenuRadioItem
          v-for="filter in matchingDates"
          :key="filter.value"
          :value="filter.value"
          :class="menuItemClass"
          @click="dateFilter = filter.value"
          @keydown="handleSearchResultKeydown"
          @select.prevent
        >
          <span class="flex-1">{{ $t(filter.label) }}</span>
          <DropdownMenuItemIndicator class="size-4 shrink-0">
            <i class="icon-[lucide--check]" />
          </DropdownMenuItemIndicator>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </template>

    <div
      v-if="!hasSearchResults"
      class="px-2 py-1.5 text-sm text-muted-foreground"
    >
      {{ $t('sideToolbar.mediaAssets.filterNoMatches') }}
    </div>
  </template>

  <DropdownMenuLabel v-if="!isSearching" :class="groupLabelClass">
    {{ $t('sideToolbar.mediaAssets.filterGroupAttribute') }}
  </DropdownMenuLabel>

  <DropdownMenuSub v-if="!isSearching">
    <DropdownMenuSubTrigger :class="menuItemClass">
      <i class="icon-[lucide--image] size-4 shrink-0 text-muted-foreground" />
      <span class="flex-1 text-left">
        {{ $t('sideToolbar.mediaAssets.filterMediaType') }}
      </span>
      <i
        class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground"
      />
    </DropdownMenuSubTrigger>

    <DropdownMenuPortal>
      <DropdownMenuSubContent
        :side-offset="8"
        :align-offset="-9"
        :collision-padding="10"
        :prioritize-position="false"
        :class="submenuClass"
      >
        <DropdownMenuCheckboxItem
          v-for="filter in mediaTypeFilterOptions"
          :key="filter.value"
          :model-value="mediaTypeFilters.includes(filter.value)"
          :class="menuItemClass"
          @click="toggleMediaType(filter.value)"
          @select.prevent
        >
          <span class="flex-1">{{ $t(filter.label) }}</span>
          <DropdownMenuItemIndicator class="size-4 shrink-0">
            <i class="icon-[lucide--check]" />
          </DropdownMenuItemIndicator>
        </DropdownMenuCheckboxItem>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>

  <DropdownMenuSub v-if="!isSearching">
    <DropdownMenuSubTrigger :class="menuItemClass">
      <i
        class="icon-[lucide--calendar] size-4 shrink-0 text-muted-foreground"
      />
      <span class="flex-1 text-left">
        {{ $t('sideToolbar.mediaAssets.filterDate') }}
      </span>
      <i
        class="icon-[lucide--chevron-right] size-4 shrink-0 text-muted-foreground"
      />
    </DropdownMenuSubTrigger>

    <DropdownMenuPortal>
      <DropdownMenuSubContent
        :side-offset="8"
        :align-offset="-9"
        :collision-padding="10"
        :prioritize-position="false"
        :class="submenuClass"
      >
        <DropdownMenuRadioGroup :model-value="dateFilter">
          <DropdownMenuRadioItem
            v-for="filter in dateFilterOptions"
            :key="filter.value"
            :value="filter.value"
            :class="menuItemClass"
            @click="dateFilter = filter.value"
            @select.prevent
          >
            <span class="flex-1">{{ $t(filter.label) }}</span>
            <DropdownMenuItemIndicator class="size-4 shrink-0">
              <i class="icon-[lucide--check]" />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>

<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  dateFilterOptions,
  mediaTypeFilterOptions
} from '@/platform/assets/mediaAssetFilterOptions'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

const dateFilter = defineModel<MediaAssetDateFilter>('dateFilter', {
  required: true
})
const mediaTypeFilters = defineModel<string[]>('mediaTypeFilters', {
  required: true
})

const { t } = useI18n()
const searchInput = ref<HTMLInputElement>()
const searchQuery = ref('')
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => normalizedQuery.value.length > 0)
const matchingMediaTypes = computed(() =>
  mediaTypeFilterOptions.filter((filter) =>
    t(filter.label).toLowerCase().includes(normalizedQuery.value)
  )
)
const matchingDates = computed(() =>
  dateFilterOptions.filter((filter) =>
    t(filter.label).toLowerCase().includes(normalizedQuery.value)
  )
)
const hasSearchResults = computed(
  () => matchingMediaTypes.value.length > 0 || matchingDates.value.length > 0
)

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const groupLabelClass =
  'px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground uppercase'
const submenuClass =
  'z-1700 min-w-40 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm'

onMounted(() => {
  void nextTick(() => searchInput.value?.focus())
})

function toggleMediaType(type: string) {
  if (mediaTypeFilters.value.includes(type)) {
    mediaTypeFilters.value = mediaTypeFilters.value.filter(
      (filter) => filter !== type
    )
  } else {
    mediaTypeFilters.value = [...mediaTypeFilters.value, type]
  }
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const results = getSearchResults()
    const result = event.key === 'ArrowDown' ? results.at(0) : results.at(-1)

    if (result) {
      event.preventDefault()
      event.stopPropagation()
      result.focus()
    }
    return
  }

  if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    event.stopPropagation()
  }
}

function handleSearchResultKeydown(event: KeyboardEvent) {
  const results = getSearchResults()
  const currentIndex = results.indexOf(event.currentTarget as HTMLElement)
  const movingPastEnd =
    event.key === 'ArrowDown' && currentIndex === results.length - 1
  const movingBeforeStart = event.key === 'ArrowUp' && currentIndex === 0

  if (!movingPastEnd && !movingBeforeStart) return

  event.preventDefault()
  event.stopPropagation()
  searchInput.value?.focus()
}

function getSearchResults() {
  const menu = searchInput.value?.closest('[role="menu"]')
  return menu
    ? Array.from(
        menu.querySelectorAll<HTMLElement>(
          '[role="menuitemcheckbox"], [role="menuitemradio"]'
        )
      )
    : []
}
</script>
