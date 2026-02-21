<template>
  <div class="flex flex-col">
    <Button
      variant="textonly"
      class="w-full"
      @click="handleSortChange('newest')"
    >
      <span>{{ $t('sideToolbar.mediaAssets.sortNewestFirst') }}</span>
      <i
        class="icon-[lucide--check] ml-auto size-4"
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
        class="icon-[lucide--check] ml-auto size-4"
        :class="sortBy !== 'oldest' && 'opacity-0'"
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
          class="icon-[lucide--check] ml-auto size-4"
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
          class="icon-[lucide--check] ml-auto size-4"
          :class="sortBy !== 'fastest' && 'opacity-0'"
        />
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
