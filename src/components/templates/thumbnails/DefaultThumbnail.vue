<template>
  <BaseThumbnail :hover-zoom="hoverZoom" :is-hovered="isHovered">
    <div class="overflow-hidden">
      <img
        :src="src"
        :alt="alt"
        draggable="false"
        class="w-64 h-64 object-cover transform-gpu transition-transform duration-300 ease-out"
        :style="
          isHovered ? { transform: `scale(${1 + hoverZoom / 100})` } : undefined
        "
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

defineProps<{
  src: string
  alt: string
  hoverZoom: number
  isHovered?: boolean
}>()
</script>
