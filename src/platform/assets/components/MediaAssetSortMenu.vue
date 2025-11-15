<template>
  <div class="flex flex-col">
    <IconTextButton
      type="transparent"
      icon-position="right"
      :label="$t('sideToolbar.mediaAssets.sortNewestFirst')"
      @click="handleSortChange('newest')"
    >
      <template #icon>
        <i v-if="sortBy === 'newest'" class="icon-[lucide--check] size-4" />
      </template>
    </IconTextButton>

    <IconTextButton
      type="transparent"
      icon-position="right"
      :label="$t('sideToolbar.mediaAssets.sortOldestFirst')"
      @click="handleSortChange('oldest')"
    >
      <template #icon>
        <i v-if="sortBy === 'oldest'" class="icon-[lucide--check] size-4" />
      </template>
    </IconTextButton>

    <template v-if="showGenerationTimeSort">
      <IconTextButton
        type="transparent"
        icon-position="right"
        :label="$t('sideToolbar.mediaAssets.sortLongestFirst')"
        @click="handleSortChange('longest')"
      >
        <template #icon>
          <i v-if="sortBy === 'longest'" class="icon-[lucide--check] size-4" />
        </template>
      </IconTextButton>

      <IconTextButton
        type="transparent"
        icon-position="right"
        :label="$t('sideToolbar.mediaAssets.sortFastestFirst')"
        @click="handleSortChange('fastest')"
      >
        <template #icon>
          <i v-if="sortBy === 'fastest'" class="icon-[lucide--check] size-4" />
        </template>
      </IconTextButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import IconTextButton from '@/components/button/IconTextButton.vue'

const {
  sortBy,
  close,
  showGenerationTimeSort = false
} = defineProps<{
  sortBy: 'newest' | 'oldest' | 'longest' | 'fastest'
  close: () => void
  showGenerationTimeSort?: boolean
}>()

const emit = defineEmits<{
  'update:sortBy': [value: 'newest' | 'oldest' | 'longest' | 'fastest']
}>()

const handleSortChange = (
  value: 'newest' | 'oldest' | 'longest' | 'fastest'
) => {
  emit('update:sortBy', value)
  close()
}
</script>
