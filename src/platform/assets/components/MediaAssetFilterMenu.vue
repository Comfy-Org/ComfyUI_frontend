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
        class="z-1700 min-w-40 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm"
      >
        <DropdownMenuCheckboxItem
          v-for="filter in filters"
          :key="filter.type"
          :model-value="mediaTypeFilters.includes(filter.type)"
          :class="menuItemClass"
          @click="toggleMediaType(filter.type)"
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
</template>

<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { nextTick, ref } from 'vue'

const { mediaTypeFilters } = defineProps<{
  mediaTypeFilters: string[]
}>()

const emit = defineEmits<{
  'update:mediaTypeFilters': [value: string[]]
}>()

const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover'
const mediaTypeMenuOpen = ref(false)

const filters = [
  { type: 'image', label: 'sideToolbar.mediaAssets.filterImage' },
  { type: 'video', label: 'sideToolbar.mediaAssets.filterVideo' },
  { type: 'audio', label: 'sideToolbar.mediaAssets.filterAudio' },
  { type: '3d', label: 'sideToolbar.mediaAssets.filter3D' },
  { type: 'text', label: 'sideToolbar.mediaAssets.filterText' }
]

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
