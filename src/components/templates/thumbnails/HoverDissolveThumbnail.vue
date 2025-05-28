<template>
  <BaseThumbnail :is-hovered="isHovered">
    <div class="relative w-full h-full">
      <img
        :src="baseImageSrc"
        :alt="alt"
        draggable="false"
        class="absolute inset-0"
        :class="
          isVideoType
            ? 'w-full h-full object-cover'
            : 'max-w-full max-h-64 object-contain'
        "
      />
      <img
        :src="overlayImageSrc"
        :alt="alt"
        draggable="false"
        class="absolute inset-0 transition-opacity duration-300"
        :class="[
          isVideoType
            ? 'w-full h-full object-cover'
            : 'max-w-full max-h-64 object-contain',
          { 'opacity-100': isHovered, 'opacity-0': !isHovered }
        ]"
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const { baseImageSrc, overlayImageSrc, isVideo } = defineProps<{
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
</script>
