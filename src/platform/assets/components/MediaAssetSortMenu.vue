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
  </div>
</template>

<script setup lang="ts">
import IconTextButton from '@/components/button/IconTextButton.vue'

const { sortBy, close } = defineProps<{
  sortBy: 'newest' | 'oldest'
  close: () => void
}>()

const emit = defineEmits<{
  'update:sortBy': [value: 'newest' | 'oldest']
}>()

const handleSortChange = (value: 'newest' | 'oldest') => {
  emit('update:sortBy', value)
  close()
}
</script>
