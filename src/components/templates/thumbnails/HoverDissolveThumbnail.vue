<template>
  <BaseThumbnail :is-hovered="isHovered">
    <div class="relative w-full h-full">
      <LazyImage :src="baseImageSrc" :alt="alt" :image-class="baseImageClass" />
      <LazyImage
        :src="overlayImageSrc"
        :alt="alt"
        :image-class="overlayImageClass"
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import LazyImage from '@/components/common/LazyImage.vue'
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const { baseImageSrc, overlayImageSrc, isVideo, isHovered } = defineProps<{
  baseImageSrc: string
  overlayImageSrc: string
  alt: string
  isHovered: boolean
  isVideo?: boolean
}>()

const isVideoType =
  isVideo ||
  baseImageSrc?.toLowerCase().endsWith('.webp') ||
  overlayImageSrc?.toLowerCase().endsWith('.webp') ||
  false

const baseImageClass = computed(() => {
  return `absolute inset-0 ${isVideoType ? 'w-full h-full object-cover' : 'max-w-full max-h-64 object-contain'}`
})

const overlayImageClass = computed(() => {
  const baseClasses = 'absolute inset-0 transition-opacity duration-300'
  const sizeClasses = isVideoType
    ? 'w-full h-full object-cover'
    : 'max-w-full max-h-64 object-contain'
  const opacityClasses = isHovered ? 'opacity-100' : 'opacity-0'
  return `${baseClasses} ${sizeClasses} ${opacityClasses}`
})
</script>
