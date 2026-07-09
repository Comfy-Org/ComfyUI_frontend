<template>
  <div class="flex flex-col">
    <Button
      variant="textonly"
      class="w-full"
      @click="handleViewModeChange('list')"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--table-of-contents] size-4" />
        <span>{{ $t('sideToolbar.queueProgressOverlay.viewList') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== 'list' && 'opacity-0'"
      />
    </Button>

    <Button
      variant="textonly"
      class="w-full"
      @click="handleViewModeChange('grid-small')"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--grid-3x3] size-4" />
        <span>{{ $t('sideToolbar.mediaAssets.viewGridSmall') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== 'grid-small' && 'opacity-0'"
      />
    </Button>

    <Button
      variant="textonly"
      class="w-full"
      @click="handleViewModeChange('grid-large')"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--layout-grid] size-4" />
        <span>{{ $t('sideToolbar.mediaAssets.viewGridLarge') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== 'grid-large' && 'opacity-0'"
      />
    </Button>

    <template v-if="showSortOptions">
      <div class="my-1 w-full border-b border-border-subtle" />

      <Button
        variant="textonly"
        class="w-full"
        @click="handleSortChange('newest')"
      >
        <span>{{ $t('sideToolbar.mediaAssets.sortNewestFirst') }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="sortBy !== 'newest' && 'opacity-0'"
        />
      </Button>

      <Button
        variant="textonly"
        class="w-full"
        @click="handleSortChange('oldest')"
      >
        <span>{{ $t('sideToolbar.mediaAssets.sortOldestFirst') }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="sortBy !== 'oldest' && 'opacity-0'"
        />
      </Button>

      <Button variant="textonly" class="w-full" @click="handleSortChange('az')">
        <span>{{ $t('sideToolbar.mediaAssets.sortAToZ') }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="sortBy !== 'az' && 'opacity-0'"
        />
      </Button>

      <Button variant="textonly" class="w-full" @click="handleSortChange('za')">
        <span>{{ $t('sideToolbar.mediaAssets.sortZToA') }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="sortBy !== 'za' && 'opacity-0'"
        />
      </Button>

      <template v-if="showGenerationTimeSort">
        <Button
          variant="textonly"
          class="w-full"
          @click="handleSortChange('longest')"
        >
          <span>{{ $t('sideToolbar.mediaAssets.sortLongestFirst') }}</span>
          <i
            class="ml-auto icon-[lucide--check] size-4"
            :class="sortBy !== 'longest' && 'opacity-0'"
          />
        </Button>

        <Button
          variant="textonly"
          class="w-full"
          @click="handleSortChange('fastest')"
        >
          <span>{{ $t('sideToolbar.mediaAssets.sortFastestFirst') }}</span>
          <i
            class="ml-auto icon-[lucide--check] size-4"
            :class="sortBy !== 'fastest' && 'opacity-0'"
          />
        </Button>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

import type { MediaAssetViewMode } from './mediaAssetViewOptions'

export type SortBy = 'newest' | 'oldest' | 'longest' | 'fastest' | 'az' | 'za'

const { showSortOptions = false, showGenerationTimeSort = false } =
  defineProps<{
    showSortOptions?: boolean
    showGenerationTimeSort?: boolean
  }>()

const viewMode = defineModel<MediaAssetViewMode>('viewMode', { required: true })
const sortBy = defineModel<SortBy>('sortBy', { required: true })

function handleViewModeChange(value: MediaAssetViewMode) {
  viewMode.value = value
}

function handleSortChange(value: SortBy) {
  sortBy.value = value
}
</script>
