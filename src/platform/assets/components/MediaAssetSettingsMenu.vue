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
      @click="handleViewModeChange('grid')"
    >
      <span class="flex items-center gap-2">
        <i class="icon-[lucide--layout-grid] size-4" />
        <span>{{ $t('sideToolbar.queueProgressOverlay.viewGrid') }}</span>
      </span>
      <i
        class="ml-auto icon-[lucide--check] size-4"
        :class="viewMode !== 'grid' && 'opacity-0'"
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

      <template v-if="showAlphabeticalSort">
        <Button
          variant="textonly"
          class="w-full"
          @click="handleSortChange('name-asc')"
        >
          <span>{{ $t('sideToolbar.mediaAssets.sortNameAsc') }}</span>
          <i
            class="ml-auto icon-[lucide--check] size-4"
            :class="sortBy !== 'name-asc' && 'opacity-0'"
          />
        </Button>

        <Button
          variant="textonly"
          class="w-full"
          @click="handleSortChange('name-desc')"
        >
          <span>{{ $t('sideToolbar.mediaAssets.sortNameDesc') }}</span>
          <i
            class="ml-auto icon-[lucide--check] size-4"
            :class="sortBy !== 'name-desc' && 'opacity-0'"
          />
        </Button>
      </template>

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

    <template v-if="showAssetToggles">
      <div class="my-1 w-full border-b border-border-subtle" />

      <Button
        variant="textonly"
        class="w-full"
        role="menuitemcheckbox"
        :aria-checked="groupByJob"
        @click="groupByJob = !groupByJob"
      >
        <span>{{ $t('sideToolbar.mediaAssets.groupByJob') }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="!groupByJob && 'opacity-0'"
        />
      </Button>

      <Button
        variant="textonly"
        class="w-full"
        role="menuitemcheckbox"
        :aria-checked="showPreviewAssets"
        @click="showPreviewAssets = !showPreviewAssets"
      >
        <span>{{ $t('sideToolbar.mediaAssets.showPreviewAssets') }}</span>
        <i
          class="ml-auto icon-[lucide--check] size-4"
          :class="!showPreviewAssets && 'opacity-0'"
        />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

export type SortBy =
  | 'newest'
  | 'oldest'
  | 'longest'
  | 'fastest'
  | 'name-asc'
  | 'name-desc'

const {
  showSortOptions = false,
  showGenerationTimeSort = false,
  showAlphabeticalSort = false,
  showAssetToggles = false
} = defineProps<{
  showSortOptions?: boolean
  showGenerationTimeSort?: boolean
  showAlphabeticalSort?: boolean
  showAssetToggles?: boolean
}>()

const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })
const sortBy = defineModel<SortBy>('sortBy', { required: true })
const showPreviewAssets = defineModel<boolean>('showPreviewAssets', {
  default: false
})
const groupByJob = defineModel<boolean>('groupByJob', { default: false })

function handleViewModeChange(value: 'list' | 'grid') {
  viewMode.value = value
}

function handleSortChange(value: SortBy) {
  sortBy.value = value
}
</script>
