<template>
  <BaseThumbnail>
    <div ref="containerRef" class="overflow-hidden">
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
import { useElementHover } from '@vueuse/core'
import { ref } from 'vue'

import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const { hoverZoom = 8 } = defineProps<{
  src: string
  alt: string
  hoverZoom?: number
}>()

const containerRef = ref<HTMLElement | null>(null)
const isHovered = useElementHover(containerRef)
</script>

<style scoped>
img {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
