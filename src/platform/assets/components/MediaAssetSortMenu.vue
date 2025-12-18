<template>
  <div class="flex flex-col">
    <Button
      variant="textonly"
      class="justify-start"
      @click="handleSortChange('newest')"
    >
      <span>{{ $t('sideToolbar.mediaAssets.sortNewestFirst') }}</span>
      <i v-if="sortBy === 'newest'" class="icon-[lucide--check] size-4" />
    </Button>

    <Button
      variant="textonly"
      class="justify-start"
      @click="handleSortChange('oldest')"
    >
      {{ $t('sideToolbar.mediaAssets.sortOldestFirst') }}
      <i v-if="sortBy === 'oldest'" class="icon-[lucide--check] size-4" />
    </Button>

    <template v-if="showGenerationTimeSort">
      <Button
        variant="textonly"
        class="justify-start"
        @click="handleSortChange('longest')"
      >
        {{ $t('sideToolbar.mediaAssets.sortLongestFirst') }}
        <i v-if="sortBy === 'longest'" class="icon-[lucide--check] size-4" />
      </Button>

      <Button
        variant="textonly"
        class="justify-start"
        @click="handleSortChange('fastest')"
      >
        {{ $t('sideToolbar.mediaAssets.sortFastestFirst') }}
        <i v-if="sortBy === 'fastest'" class="icon-[lucide--check] size-4" />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

export type SortBy = 'newest' | 'oldest' | 'longest' | 'fastest'

const { close, showGenerationTimeSort = false } = defineProps<{
  close: () => void
  showGenerationTimeSort?: boolean
}>()

const sortBy = defineModel<SortBy>('sortBy', { required: true })

const handleSortChange = (value: SortBy) => {
  sortBy.value = value
  close()
}
</script>
