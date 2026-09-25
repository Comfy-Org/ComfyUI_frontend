<template>
  <div class="flex flex-col gap-1">
    <WidgetGalleriaCarousel
      v-model:active-index="activeIndex"
      :images="galleryImages"
      :show-thumbnails="showThumbnails"
      :show-nav-buttons="showNavButtons"
      :circular="widget.options?.circular"
      :auto-play="widget.options?.autoPlay"
      :transition-interval="widget.options?.transitionInterval"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetGalleriaCarousel from './WidgetGalleriaCarousel.vue'

export interface GalleryImage {
  itemImageSrc?: string
  thumbnailImageSrc?: string
  src?: string
  alt?: string
}

export type GalleryValue = string[] | GalleryImage[]

interface GalleryWidgetOptions extends IWidgetOptions {
  circular?: boolean
  autoPlay?: boolean
  transitionInterval?: number
}

const value = defineModel<GalleryValue>({ required: true })

const { widget } = defineProps<{
  widget: SimplifiedWidget<GalleryValue, GalleryWidgetOptions>
}>()

const activeIndex = ref(0)

const galleryImages = computed(() => {
  if (!value.value || !Array.isArray(value.value)) return []

  return value.value
    .filter((item) => item !== null && item !== undefined)
    .map((item) => {
      if (typeof item === 'string') {
        return {
          itemImageSrc: item,
          thumbnailImageSrc: item,
          alt: undefined
        }
      }
      return item ?? {}
    })
})

const showThumbnails = computed(() => {
  return (
    widget.options?.showThumbnails !== false && galleryImages.value.length > 1
  )
})

const showNavButtons = computed(() => {
  return (
    widget.options?.showItemNavigators !== false &&
    galleryImages.value.length > 1
  )
})
</script>
