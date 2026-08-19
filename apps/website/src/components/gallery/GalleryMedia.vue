<script setup lang="ts">
import type { GalleryItem } from '../../data/gallery'

// The gallery item's media element: an autoplaying video when the item has one
// (with the thumbnail as its poster), otherwise the thumbnail still. The title
// is the text alternative for both — `aria-label` for video, `alt` for image.
// Sizing, radius, and transition classes are left to the caller and fall
// through onto the rendered element.
defineProps<{ item: GalleryItem }>()
</script>

<template>
  <video
    v-if="item.video"
    :src="item.video"
    :poster="item.thumbnail"
    :aria-label="item.title"
    autoplay
    loop
    muted
    playsinline
  />
  <img v-else :src="item.thumbnail" :alt="item.title" />
</template>
