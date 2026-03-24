<template>
  <BaseThumbnail :hover-zoom="hoverZoom" :is-hovered="isHovered">
    <LazyImage
      :src="src"
      :alt="alt"
      :image-class="
        cn(
          'transform-gpu transition-transform duration-300 ease-out',
          isVideoType
            ? 'size-full object-cover'
            : 'max-h-64 max-w-full object-contain'
        )
      "
      :image-style="
        isHovered ? { transform: `scale(${1 + hoverZoom / 100})` } : undefined
      "
    />
  </BaseThumbnail>
</template>

<script setup lang="ts">
import LazyImage from '@/components/common/LazyImage.vue'
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'
import { cn } from '@/utils/tailwindUtil'

const { src, isVideo } = defineProps<{
  src: string
  alt: string
  hoverZoom: number
  isHovered?: boolean
  isVideo?: boolean
}>()

const isVideoType = isVideo ?? (src?.toLowerCase().endsWith('.webp') || false)
</script>
