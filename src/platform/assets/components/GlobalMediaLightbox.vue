<template>
  <MediaLightbox
    v-model:active-index="galleryStore.activeIndex"
    :all-gallery-items="galleryStore.items"
  />
</template>

<script setup lang="ts">
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import { useMediaAssetGalleryStore } from '@/platform/assets/composables/useMediaAssetGalleryStore'

const galleryStore = useMediaAssetGalleryStore()
</script>
