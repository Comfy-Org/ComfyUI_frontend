<template>
  <BaseThumbnail>
    <div class="relative w-full h-full">
      <img
        :src="baseImageSrc"
        :alt="alt"
        draggable="false"
        class="absolute inset-0 w-64 h-64 object-cover"
      />
      <img
        :src="overlayImageSrc"
        :alt="alt"
        draggable="false"
        class="absolute inset-0 w-64 h-64 object-cover transition-opacity duration-300"
        :class="{ 'opacity-100': isHovered, 'opacity-0': !isHovered }"
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

defineProps<{
  baseImageSrc: string
  overlayImageSrc: string
  alt: string
  isHovered: boolean
}>()
</script>
