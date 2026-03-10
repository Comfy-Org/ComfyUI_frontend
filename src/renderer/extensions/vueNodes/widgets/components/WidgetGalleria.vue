<template>
  <div
    class="flex max-w-full flex-col gap-4 rounded-lg bg-component-node-widget-background p-4"
  >
    <!-- Main Image -->
    <div class="relative flex items-center justify-center">
      <img
        v-if="activeItem"
        :src="activeItem.itemImageSrc || activeItem.src || ''"
        :alt="
          activeItem.alt ||
          `${t('g.galleryImage')} ${activeIndex + 1} of ${galleryImages.length}`
        "
        class="h-auto w-full object-contain"
      />
    </div>

    <!-- Thumbnail Strip with Navigation -->
    <div
      v-if="showThumbnails || showNavButtons"
      class="flex items-center justify-center gap-2"
    >
      <!-- Previous Button -->
      <button
        v-if="showNavButtons"
        class="text-node-component-foreground-secondary cursor-pointer"
        :aria-label="t('g.previousImage')"
        @click="goToPrevious"
      >
        <i class="icon-[lucide--chevron-left] size-3.5" />
      </button>

      <!-- Thumbnails -->
      <div
        v-if="showThumbnails"
        class="flex items-center gap-2 overflow-x-hidden scroll-smooth"
      >
        <button
          v-for="(item, index) in galleryImages"
          :key="index"
          :ref="(el) => setThumbnailRef(el as HTMLElement | null, index)"
          :class="
            cn(
              'h-[54px] w-[85px] shrink-0 cursor-pointer overflow-hidden rounded-lg border border-transparent transition-colors',
              index === activeIndex && 'border-base-foreground'
            )
          "
          :aria-label="
            item.alt ||
            `${t('g.galleryThumbnail')} ${index + 1} of ${galleryImages.length}`
          "
          @click="setActiveIndex(index)"
        >
          <img
            :src="item.thumbnailImageSrc || item.src || ''"
            :alt="
              item.alt ||
              `${t('g.galleryThumbnail')} ${index + 1} of ${galleryImages.length}`
            "
            class="size-full rounded-md object-cover"
          />
        </button>
      </div>

      <!-- Next Button -->
      <button
        v-if="showNavButtons"
        class="text-node-component-foreground-secondary cursor-pointer"
        :aria-label="t('g.nextImage')"
        @click="goToNext"
      >
        <i class="icon-[lucide--chevron-right] size-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

export interface GalleryImage {
  itemImageSrc?: string
  thumbnailImageSrc?: string
  src?: string
  alt?: string
}

export type GalleryValue = string[] | GalleryImage[]

interface GalleryOptions {
  showThumbnails?: boolean
  showItemNavigators?: boolean
}

const value = defineModel<GalleryValue>({ required: true })

const { widget } = defineProps<{
  widget: SimplifiedWidget<GalleryValue>
}>()

const activeIndex = ref(0)
const thumbnailRefs = ref<(HTMLElement | null)[]>([])

const { t } = useI18n()

const options = computed<GalleryOptions>(() => widget.options ?? {})

const galleryImages = computed<GalleryImage[]>(() => {
  if (!value.value || !Array.isArray(value.value)) return []

  return value.value
    .filter((item) => item !== null && item !== undefined)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          itemImageSrc: item,
          thumbnailImageSrc: item,
          alt: `Image ${index}`
        }
      }
      return item ?? {}
    })
})

const activeItem = computed(() => galleryImages.value[activeIndex.value])

watch(galleryImages, (images) => {
  thumbnailRefs.value = thumbnailRefs.value.slice(0, images.length)
  if (images.length === 0) {
    activeIndex.value = 0
    return
  }
  if (activeIndex.value >= images.length) {
    activeIndex.value = images.length - 1
  }
})

const showThumbnails = computed(
  () => options.value.showThumbnails !== false && galleryImages.value.length > 1
)

const showNavButtons = computed(
  () =>
    options.value.showItemNavigators !== false && galleryImages.value.length > 1
)

function setThumbnailRef(el: HTMLElement | null, index: number) {
  thumbnailRefs.value[index] = el
}

function scrollToActive() {
  void nextTick(() => {
    const el = thumbnailRefs.value[activeIndex.value]
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  })
}

function setActiveIndex(index: number) {
  activeIndex.value = index
  scrollToActive()
}

function goToPrevious() {
  if (activeIndex.value > 0) {
    activeIndex.value--
  } else {
    activeIndex.value = galleryImages.value.length - 1
  }
  scrollToActive()
}

function goToNext() {
  if (activeIndex.value < galleryImages.value.length - 1) {
    activeIndex.value++
  } else {
    activeIndex.value = 0
  }
  scrollToActive()
}
</script>
