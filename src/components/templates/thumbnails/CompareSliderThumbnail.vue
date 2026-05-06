<template>
  <BaseThumbnail :is-hovered="isHovered">
    <LazyImage
      :src="baseImageSrc"
      :alt="alt"
      :image-class="
        isVideoType
          ? 'w-full h-full object-cover'
          : 'max-w-full max-h-64 object-contain'
      "
    />
    <div
      data-testid="compare-slider-container"
      class="absolute inset-0"
      @mousemove="updateSliderPosition"
    >
      <LazyImage
        :src="overlayImageSrc"
        :alt="alt"
        :image-class="
          isVideoType
            ? 'w-full h-full object-cover'
            : 'max-w-full max-h-64 object-contain'
        "
        :image-style="{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
        }"
      />
      <div
        data-testid="compare-slider-divider"
        class="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white/30 backdrop-blur-sm"
        :style="{
          left: `${sliderPosition}%`
        }"
      />
    </div>
  </BaseThumbnail>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import LazyImage from '@/components/common/LazyImage.vue'
import BaseThumbnail from '@/components/templates/thumbnails/BaseThumbnail.vue'

const SLIDER_START_POSITION = 50

const { baseImageSrc, overlayImageSrc, isHovered, isVideo } = defineProps<{
  baseImageSrc: string
  overlayImageSrc: string
  alt: string
  isHovered?: boolean
  isVideo?: boolean
}>()

const isVideoType =
  isVideo ||
  baseImageSrc?.toLowerCase().endsWith('.webp') ||
  overlayImageSrc?.toLowerCase().endsWith('.webp') ||
  false

const sliderPosition = ref(SLIDER_START_POSITION)

/**
 * Update slider position from a local mousemove. Scoped to currentTarget so
 * only the hovered card reads its rect — unlike useMouseInElement which
 * attaches a global mousemove listener and fires for every mounted instance.
 */
function updateSliderPosition(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) return
  sliderPosition.value = ((event.clientX - rect.left) / rect.width) * 100
}
</script>
