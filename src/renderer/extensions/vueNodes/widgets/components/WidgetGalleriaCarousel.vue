<template>
  <div
    class="max-w-full overflow-hidden rounded-lg border border-border-default"
    role="region"
    :aria-label="t('g.galleryImage')"
  >
    <div class="relative flex items-center justify-center">
      <img
        v-if="activeItem"
        :src="itemSrc(activeItem)"
        :alt="itemAlt(activeItem, activeIndex)"
        class="h-auto max-h-64 w-full object-contain"
      />
      <button
        v-if="showNavButtons"
        type="button"
        :aria-label="t('g.previousImage')"
        :disabled="previousDisabled"
        :class="cn(navButtonClass, 'left-2')"
        @click="previous"
      >
        <i class="icon-[lucide--chevron-left] size-4" />
      </button>
      <button
        v-if="showNavButtons"
        type="button"
        :aria-label="t('g.nextImage')"
        :disabled="nextDisabled"
        :class="cn(navButtonClass, 'right-2')"
        @click="next"
      >
        <i class="icon-[lucide--chevron-right] size-4" />
      </button>
    </div>

    <div v-if="showThumbnails" class="overflow-x-auto px-2 py-4">
      <div class="flex min-w-max items-center justify-center gap-1">
        <button
          v-for="(image, index) in images"
          :key="`${itemThumbnail(image)}-${index}`"
          type="button"
          :class="
            cn(
              'size-12 shrink-0 overflow-hidden rounded-lg border-0 p-1 opacity-50 transition-opacity hover:opacity-100',
              index === activeIndex && 'opacity-100'
            )
          "
          :aria-label="thumbnailAlt(image, index)"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="select(index)"
        >
          <img
            :src="itemThumbnail(image)"
            :alt="thumbnailAlt(image, index)"
            class="size-full rounded-lg object-cover"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { GalleryImage } from './WidgetGalleria.vue'

const {
  images,
  showThumbnails = false,
  showNavButtons = false,
  circular = false,
  autoPlay = false,
  transitionInterval = 4000
} = defineProps<{
  images: GalleryImage[]
  showThumbnails?: boolean
  showNavButtons?: boolean
  circular?: boolean
  autoPlay?: boolean
  transitionInterval?: number
}>()

const activeIndex = defineModel<number>('activeIndex', { default: 0 })
const { t } = useI18n()

const activeItem = computed(() => images[activeIndex.value])
const previousDisabled = computed(() => !circular && activeIndex.value === 0)
const nextDisabled = computed(
  () => !circular && activeIndex.value === images.length - 1
)

const navButtonClass =
  'absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-secondary-background/80 text-base-foreground transition-colors hover:bg-secondary-background disabled:pointer-events-none disabled:opacity-40'

function itemSrc(image: GalleryImage) {
  return image.itemImageSrc || image.src || ''
}

function itemThumbnail(image: GalleryImage) {
  return image.thumbnailImageSrc || image.itemImageSrc || image.src || ''
}

function itemAlt(image: GalleryImage, index: number) {
  return image.alt || `${t('g.galleryImage')} ${index + 1} of ${images.length}`
}

function thumbnailAlt(image: GalleryImage, index: number) {
  return (
    image.alt || `${t('g.galleryThumbnail')} ${index + 1} of ${images.length}`
  )
}

function goNext() {
  if (images.length < 2) return
  if (activeIndex.value < images.length - 1) {
    activeIndex.value += 1
  } else if (circular) {
    activeIndex.value = 0
  }
}

const { pause, resume } = useIntervalFn(goNext, () => transitionInterval, {
  immediate: false
})

function previous() {
  pause()
  if (activeIndex.value > 0) {
    activeIndex.value -= 1
  } else if (circular) {
    activeIndex.value = images.length - 1
  }
}

function next() {
  pause()
  goNext()
}

function select(index: number) {
  pause()
  activeIndex.value = index
}

watch(
  () => images.length,
  (length) => {
    if (length === 0) activeIndex.value = 0
    else if (activeIndex.value >= length) activeIndex.value = length - 1
  }
)

watch(
  [() => autoPlay, () => images.length],
  ([shouldPlay, length]) => {
    if (shouldPlay && length > 1) resume()
    else pause()
  },
  { immediate: true }
)
</script>
