<template>
  <MediaLightbox
    v-model:active-index="galleryStore.activeIndex"
    :all-gallery-items="galleryStore.items"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'

import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import { useMediaAssetGalleryStore } from '@/platform/assets/composables/useMediaAssetGalleryStore'

const galleryStore = useMediaAssetGalleryStore()

// The store outlives this renderer, so a gallery left open on teardown would
// reappear on the next mount, over a graph that may no longer hold it.
onBeforeUnmount(() => galleryStore.close())
</script>
