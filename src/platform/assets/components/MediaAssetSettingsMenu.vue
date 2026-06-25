<template>
  <DropdownMenuItem @select="handleViewModeChange('list')">
    <template #icon><i class="icon-[lucide--table-of-contents]" /></template>
    {{ $t('sideToolbar.queueProgressOverlay.viewList') }}
    <i
      v-if="viewMode === 'list'"
      class="ml-auto icon-[lucide--check] size-3.5"
    />
  </DropdownMenuItem>

  <DropdownMenuItem @select="handleViewModeChange('grid')">
    <template #icon><i class="icon-[lucide--layout-grid]" /></template>
    {{ $t('sideToolbar.queueProgressOverlay.viewGrid') }}
    <i
      v-if="viewMode === 'grid'"
      class="ml-auto icon-[lucide--check] size-3.5"
    />
  </DropdownMenuItem>

  <template v-if="showSortOptions">
    <DropdownMenuSeparator />

    <DropdownMenuItem @select="handleSortChange('newest')">
      {{ $t('sideToolbar.mediaAssets.sortNewestFirst') }}
      <i
        v-if="sortBy === 'newest'"
        class="ml-auto icon-[lucide--check] size-3.5"
      />
    </DropdownMenuItem>

    <DropdownMenuItem @select="handleSortChange('oldest')">
      {{ $t('sideToolbar.mediaAssets.sortOldestFirst') }}
      <i
        v-if="sortBy === 'oldest'"
        class="ml-auto icon-[lucide--check] size-3.5"
      />
    </DropdownMenuItem>

    <template v-if="showGenerationTimeSort">
      <DropdownMenuItem @select="handleSortChange('longest')">
        {{ $t('sideToolbar.mediaAssets.sortLongestFirst') }}
        <i
          v-if="sortBy === 'longest'"
          class="ml-auto icon-[lucide--check] size-3.5"
        />
      </DropdownMenuItem>

      <DropdownMenuItem @select="handleSortChange('fastest')">
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

function handleViewModeChange(value: 'list' | 'grid') {
  viewMode.value = value
}

function handleSortChange(value: SortBy) {
  sortBy.value = value
}
</script>
