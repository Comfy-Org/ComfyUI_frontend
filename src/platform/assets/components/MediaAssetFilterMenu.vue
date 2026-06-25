<template>
  <DropdownMenuCheckboxItem
    v-for="filter in filters"
    :key="filter.type"
    :checked="mediaTypeFilters.includes(filter.type)"
    @select="(event) => event.preventDefault()"
    @update:checked="toggleMediaType(filter.type)"
  >
    {{ $t(filter.label) }}
  </DropdownMenuCheckboxItem>
</template>

<script setup lang="ts">
import DropdownMenuCheckboxItem from '@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue'

const { mediaTypeFilters } = defineProps<{
  mediaTypeFilters: string[]
}>()

const emit = defineEmits<{
  'update:mediaTypeFilters': [value: string[]]
}>()

const filters = [
  { type: 'image', label: 'sideToolbar.mediaAssets.filterImage' },
  { type: 'video', label: 'sideToolbar.mediaAssets.filterVideo' },
  { type: 'audio', label: 'sideToolbar.mediaAssets.filterAudio' },
  { type: '3d', label: 'sideToolbar.mediaAssets.filter3D' }
]

const toggleMediaType = (type: string) => {
  const isCurrentlySelected = mediaTypeFilters.includes(type)
  if (isCurrentlySelected) {
    emit(
      'update:mediaTypeFilters',
      mediaTypeFilters.filter((t) => t !== type)
    )
  } else {
    emit('update:mediaTypeFilters', [...mediaTypeFilters, type])
  }
}
</script>
