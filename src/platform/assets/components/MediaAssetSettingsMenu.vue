<template>
  <DropdownMenuItem @select="(e: Event) => handleViewModeChange(e, 'list')">
    <template #icon><i class="icon-[lucide--table-of-contents]" /></template>
    {{ $t('sideToolbar.queueProgressOverlay.viewList') }}
    <i
      v-if="viewMode === 'list'"
      class="ml-auto icon-[lucide--check] size-3.5"
    />
  </DropdownMenuItem>

  <DropdownMenuItem @select="(e: Event) => handleViewModeChange(e, 'grid')">
    <template #icon><i class="icon-[lucide--layout-grid]" /></template>
    {{ $t('sideToolbar.queueProgressOverlay.viewGrid') }}
    <i
      v-if="viewMode === 'grid'"
      class="ml-auto icon-[lucide--check] size-3.5"
    />
  </DropdownMenuItem>

  <template v-if="showSortOptions">
    <DropdownMenuSeparator />

    <DropdownMenuItem @select="(e: Event) => handleSortChange(e, 'newest')">
      {{ $t('sideToolbar.mediaAssets.sortNewestFirst') }}
      <i
        v-if="sortBy === 'newest'"
        class="ml-auto icon-[lucide--check] size-3.5"
      />
    </DropdownMenuItem>

    <DropdownMenuItem @select="(e: Event) => handleSortChange(e, 'oldest')">
      {{ $t('sideToolbar.mediaAssets.sortOldestFirst') }}
      <i
        v-if="sortBy === 'oldest'"
        class="ml-auto icon-[lucide--check] size-3.5"
      />
    </DropdownMenuItem>

    <template v-if="showGenerationTimeSort">
      <DropdownMenuItem @select="(e: Event) => handleSortChange(e, 'longest')">
        {{ $t('sideToolbar.mediaAssets.sortLongestFirst') }}
        <i
          v-if="sortBy === 'longest'"
          class="ml-auto icon-[lucide--check] size-3.5"
        />
      </DropdownMenuItem>

      <DropdownMenuItem @select="(e: Event) => handleSortChange(e, 'fastest')">
        {{ $t('sideToolbar.mediaAssets.sortFastestFirst') }}
        <i
          v-if="sortBy === 'fastest'"
          class="ml-auto icon-[lucide--check] size-3.5"
        />
      </DropdownMenuItem>
    </template>
  </template>
</template>

<script setup lang="ts">
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'

export type SortBy = 'newest' | 'oldest' | 'longest' | 'fastest'

const { showSortOptions = false, showGenerationTimeSort = false } =
  defineProps<{
    showSortOptions?: boolean
    showGenerationTimeSort?: boolean
  }>()

const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })
const sortBy = defineModel<SortBy>('sortBy', { required: true })

function handleViewModeChange(event: Event, value: 'list' | 'grid') {
  event.preventDefault()
  viewMode.value = value
}

function handleSortChange(event: Event, value: SortBy) {
  event.preventDefault()
  sortBy.value = value
}
</script>
