<template>
  <DropdownMenuLabel
    class="px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground uppercase"
  >
    {{ $t('sideToolbar.mediaAssets.filterGroupAttribute') }}
  </DropdownMenuLabel>

  <DropdownMenuSub>
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

  <DropdownMenuSub>
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'

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

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const submenuClass =
  'z-1700 min-w-40 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm'

function toggleMediaType(type: string) {
  if (mediaTypeFilters.value.includes(type)) {
    mediaTypeFilters.value = mediaTypeFilters.value.filter(
      (filter) => filter !== type
    )
  } else {
    mediaTypeFilters.value = [...mediaTypeFilters.value, type]
  }
}
</script>
