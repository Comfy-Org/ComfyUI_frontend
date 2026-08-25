<script setup lang="ts">
import { computed, ref } from 'vue'

import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const props = defineProps<{
  template: TemplateInfo
  baseImageSrc: string
  overlayImageSrc: string
  alt: string
  getLogoUrl: (provider: string) => string
  isHovered?: boolean
}>()

const internalHovered = ref(false)
const hovered = computed(() => props.isHovered ?? internalHovered.value)
const isVideo = computed(
  () =>
    props.template.mediaType === 'video' ||
    props.template.mediaSubtype === 'webp'
)
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-lg"
    @mouseenter="internalHovered = true"
    @mouseleave="internalHovered = false"
  >
    <AudioThumbnail v-if="template.mediaType === 'audio'" :src="baseImageSrc" />
    <CompareSliderThumbnail
      v-else-if="template.thumbnailVariant === 'compareSlider'"
      :base-image-src="baseImageSrc"
      :overlay-image-src="overlayImageSrc"
      :alt="alt"
      :is-hovered="hovered"
      :is-video="isVideo"
    />
    <HoverDissolveThumbnail
      v-else-if="template.thumbnailVariant === 'hoverDissolve'"
      :base-image-src="baseImageSrc"
      :overlay-image-src="overlayImageSrc"
      :alt="alt"
      :is-hovered="hovered"
      :is-video="isVideo"
    />
    <DefaultThumbnail
      v-else
      :src="baseImageSrc"
      :alt="alt"
      :is-hovered="hovered"
      :is-video="isVideo"
      :hover-zoom="template.thumbnailVariant === 'zoomHover' ? 16 : 5"
    />
    <LogoOverlay
      v-if="template.logos?.length"
      :logos="template.logos"
      :get-logo-url="getLogoUrl"
      default-position="right-2 bottom-2"
    />
    <slot name="overlay" />
  </div>
</template>
