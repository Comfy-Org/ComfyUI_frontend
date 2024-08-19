<template>
  <Galleria
    v-model:visible="galleryVisible"
    @update:visible="handleVisibilityChange"
    :activeIndex="activeIndex"
    @update:activeIndex="handleActiveIndexChange"
    :value="allGalleryItems"
    :showIndicators="false"
    changeItemOnIndicatorHover
    showItemNavigators
    fullScreen
    circular
    :showThumbnails="false"
  >
    <template #item="{ item }">
      <img :src="item.url" alt="gallery item" class="galleria-image" />
    </template>
  </Galleria>
</template>

<script setup lang="ts">
import { defineProps, ref, watch, onMounted, onUnmounted } from 'vue'
import Galleria from 'primevue/galleria'
import { ResultItemImpl } from '@/stores/queueStore'

const galleryVisible = ref(false)

const emit = defineEmits<{
  (e: 'update:activeIndex', value: number): void
}>()

const props = defineProps<{
  allGalleryItems: ResultItemImpl[]
  activeIndex: number
}>()

watch(
  () => props.activeIndex,
  (index) => {
    if (index !== -1) {
      galleryVisible.value = true
    }
  }
)

const handleVisibilityChange = (visible: boolean) => {
  if (!visible) {
    emit('update:activeIndex', -1)
  }
}

const handleActiveIndexChange = (index: number) => {
  emit('update:activeIndex', index)
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!galleryVisible.value) return

  switch (event.key) {
    case 'ArrowLeft':
      navigateImage(-1)
      break
    case 'ArrowRight':
      navigateImage(1)
      break
    case 'Escape':
      galleryVisible.value = false
      break
  }
}

const navigateImage = (direction: number) => {
  const newIndex =
    (props.activeIndex + direction + props.allGalleryItems.length) %
    props.allGalleryItems.length
  emit('update:activeIndex', newIndex)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.galleria-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  /* Set z-index so the close button doesn't get hidden behind the image when image is large */
  z-index: -1;
}
</style>
