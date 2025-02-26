<template>
  <BaseThumbnail>
    <img :src="baseImageSrc" :alt="alt" class="w-full h-full object-cover" />
    <div ref="containerRef" class="absolute inset-0">
      <img
        :src="overlayImageSrc"
        :alt="alt"
        class="w-full h-full object-cover"
        :style="{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
        }"
      />
      <div
        class="absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm z-10 pointer-events-none"
        :style="{
          left: `${sliderPosition}%`
        }"
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { ref, watch } from 'vue'

import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const { isHovered } = defineProps<{
  baseImageSrc: string
  overlayImageSrc: string
  alt: string
  isHovered?: boolean
}>()

const sliderPosition = ref(21)
const containerRef = ref<HTMLElement | null>(null)

const { elementX, elementWidth, isOutside } = useMouseInElement(containerRef)

// Update slider position based on mouse position when hovered
watch(
  [() => isHovered, elementX, elementWidth, isOutside],
  ([isHovered, x, width, outside]) => {
    if (!isHovered) return
    if (!outside) {
      sliderPosition.value = (x / width) * 100
    }
  }
)
</script>
