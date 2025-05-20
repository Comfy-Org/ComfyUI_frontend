<template>
  <BaseThumbnail :hover-zoom="hoverZoom" :is-hovered="isHovered">
    <div class="overflow-hidden w-full h-full flex items-center justify-center">
      <img
        :src="src"
        :alt="alt"
        draggable="false"
        :class="[
          'transform-gpu transition-transform duration-300 ease-out',
          isVideoType
            ? 'w-full h-full object-cover'
            : 'max-w-full max-h-64 object-contain'
        ]"
        :style="
          isHovered ? { transform: `scale(${1 + hoverZoom / 100})` } : undefined
        "
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const { src, isVideo } = defineProps<{
  src: string
  alt: string
  hoverZoom: number
  isHovered?: boolean
  isVideo?: boolean
}>()

const isVideoType = isVideo ?? (src?.toLowerCase().endsWith('.webp') || false)
</script>
