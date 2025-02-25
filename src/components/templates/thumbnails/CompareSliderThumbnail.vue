<template>
  <BaseThumbnail>
    <img :src="baseImageSrc" :alt="alt" class="w-full h-full object-cover" />
    <div class="absolute inset-0">
      <img
        :src="overlayImageSrc"
        :alt="alt"
        class="w-full h-full object-cover transition-clip-path"
        :class="{ 'duration-0': hasAnimated }"
        :style="{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
        }"
      />
      <div
        class="absolute inset-y-0 w-0.5 bg-white/30 backdrop-blur-sm z-10 pointer-events-none transition-left"
        :class="{ 'duration-0': hasAnimated }"
        :style="{
          left: `${sliderPosition}%`
        }"
      />
      <input
        type="range"
        v-model="sliderPosition"
        class="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        min="0"
        max="100"
        @click.stop
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const {
  animationEndPosition = 76.3932, // golden ratio
  animationStartPosition = 14.5898,
  animationDuration = 1024,
  animationStartDelay = 32
} = defineProps<{
  baseImageSrc: string
  overlayImageSrc: string
  alt: string
  animationStartPosition?: number
  animationEndPosition?: number
  animationDuration?: number
  animationStartDelay?: number
}>()

const sliderPosition = ref(animationStartPosition)
const hasAnimated = ref(false)

onMounted(() => {
  // Animate the slider from the start position to the end position
  setTimeout(() => {
    sliderPosition.value = animationEndPosition
    setTimeout(() => {
      hasAnimated.value = true
    }, animationDuration)
  }, animationStartDelay)
})
</script>

<style lang="css" scoped>
.transition-clip-path {
  transition: clip-path 1.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-left {
  transition: left 1.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.duration-0 {
  transition-duration: 0s;
}
</style>
