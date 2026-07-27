<template>
  <DropdownMenuLabel
    class="px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground uppercase"
  >
    {{ $t('sideToolbar.mediaAssets.filterGroupAttribute') }}
  </DropdownMenuLabel>

  <DropdownMenuSub v-model:open="mediaTypeMenuOpen">
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
        :side-offset="2"
        :align-offset="-5"
        :collision-padding="10"
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
        :side-offset="2"
        :align-offset="-5"
        :collision-padding="10"
        :class="submenuClass"
      >
        <DropdownMenuRadioGroup :model-value="dateFilter">
          <DropdownMenuRadioItem
            v-for="filter in dateFilterOptions"
            :key="filter.value"
            :value="filter.value"
            :class="menuItemClass"
            @click="emit('update:dateFilter', filter.value)"
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
import { nextTick, ref } from 'vue'

import {
  dateFilterOptions,
  mediaTypeFilterOptions
} from '@/platform/assets/mediaAssetFilterOptions'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

const { dateFilter, mediaTypeFilters } = defineProps<{
  dateFilter: MediaAssetDateFilter
  mediaTypeFilters: string[]
}>()

const emit = defineEmits<{
  'update:dateFilter': [value: MediaAssetDateFilter]
  'update:mediaTypeFilters': [value: string[]]
}>()

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const submenuClass =
  'z-1700 min-w-40 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm'
const mediaTypeMenuOpen = ref(false)

function toggleMediaType(type: string) {
  if (mediaTypeFilters.includes(type)) {
    emit(
      'update:mediaTypeFilters',
      mediaTypeFilters.filter((filter) => filter !== type)
    )
  } else {
    emit('update:mediaTypeFilters', [...mediaTypeFilters, type])
  }

  // Reka closes a submenu after selection. Reopen it after that state update
  // so users can toggle multiple media types without re-entering the submenu.
  void nextTick(() => {
    mediaTypeMenuOpen.value = true
  })
}
</script>
