<template>
  <div
    class="flex max-w-full flex-col rounded-lg bg-component-node-widget-background"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Single Mode -->
    <template v-if="displayMode === 'single'">
      <div class="flex flex-col gap-2 p-4">
        <!-- Main Image Container -->
        <div class="relative flex items-center justify-center">
          <img
            v-if="activeItem"
            :src="getItemSrc(activeItem)"
            :alt="getItemAlt(activeItem, activeIndex)"
            :class="
              cn(
                'h-auto w-full rounded-sm object-contain transition-opacity',
                isHovered && 'opacity-50'
              )
            "
            @load="handleImageLoad"
          />

          <!-- Toggle to Grid (hover, top-left) -->
          <button
            v-if="isHovered && galleryImages.length > 1"
            :class="toggleButtonClass"
            class="absolute top-2 left-2"
            :aria-label="t('g.switchToGridView')"
            @click="displayMode = 'grid'"
          >
            <i class="icon-[lucide--layout-grid] size-4" />
          </button>
        </div>

        <!-- Image Dimensions -->
        <p
          :class="
            cn(
              'text-center text-xs text-component-node-foreground-secondary',
              !imageDimensions && 'invisible'
            )
          "
        >
          {{ imageDimensions || '\u00A0' }}
        </p>

        <!-- Thumbnail Strip with Navigation -->
        <div
          v-if="showThumbnails || showNavButtons"
          class="flex items-center justify-center gap-2"
        >
          <!-- Previous Button -->
          <button
            v-if="showNavButtons"
            :class="navButtonClass"
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
                  'size-10 shrink-0 cursor-pointer overflow-hidden rounded-sm border-2 border-transparent transition-colors',
                  index === activeIndex && 'border-base-foreground'
                )
              "
              :aria-label="getItemAlt(item, index)"
              @click="setActiveIndex(index)"
            >
              <img
                :src="getItemThumbnail(item)"
                :alt="getItemAlt(item, index)"
                class="size-full object-cover"
              />
            </button>
          </div>

          <!-- Next Button -->
          <button
            v-if="showNavButtons"
            :class="navButtonClass"
            :aria-label="t('g.nextImage')"
            @click="goToNext"
          >
            <i class="icon-[lucide--chevron-right] size-3.5" />
          </button>
        </div>
      </div>
    </template>

    <!-- Grid Mode -->
    <template v-else>
      <div class="p-4">
        <div
          ref="gridContainerEl"
          class="relative h-[296px] overflow-clip rounded-sm bg-component-node-background"
        >
          <!-- Toggle to Single (hover, top-left) -->
          <button
            v-if="isHovered"
            :class="toggleButtonClass"
            class="absolute top-2 left-2 z-10"
            :aria-label="t('g.switchToSingleView')"
            @click="displayMode = 'single'"
          >
            <i class="icon-[lucide--square] size-4" />
          </button>

          <div class="flex flex-wrap content-start gap-1">
            <button
              v-for="(item, index) in galleryImages"
              :key="index"
              :style="gridImageStyle"
              class="shrink-0 cursor-pointer overflow-hidden border-0 p-0"
              :aria-label="getItemAlt(item, index)"
              @mouseenter="hoveredGridIndex = index"
              @mouseleave="hoveredGridIndex = -1"
              @click="selectFromGrid(index)"
            >
              <img
                :src="getItemThumbnail(item)"
                :alt="getItemAlt(item, index)"
                :class="
                  cn(
                    'size-full object-cover transition-opacity',
                    hoveredGridIndex === index && 'opacity-50'
                  )
                "
              />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
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

type DisplayMode = 'single' | 'grid'

interface GalleryOptions {
  showThumbnails?: boolean
  showItemNavigators?: boolean
}

const value = defineModel<GalleryValue>({ required: true })

const { widget } = defineProps<{
  widget: SimplifiedWidget<GalleryValue>
}>()

const { t } = useI18n()

const activeIndex = ref(0)
const displayMode = ref<DisplayMode>('single')
const isHovered = ref(false)
const hoveredGridIndex = ref(-1)
const imageDimensions = ref<string | null>(null)
const thumbnailRefs = ref<(HTMLElement | null)[]>([])
const gridContainerEl = ref<HTMLDivElement>()

const { width: gridContainerWidth } = useElementSize(gridContainerEl)

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

const showThumbnails = computed(
  () => options.value.showThumbnails !== false && galleryImages.value.length > 1
)

const showNavButtons = computed(
  () =>
    options.value.showItemNavigators !== false && galleryImages.value.length > 1
)

const gridColumns = computed(() => {
  const count = galleryImages.value.length
  if (count <= 1) return 1
  if (count <= 4) return 2
  if (count <= 9) return 3
  if (count <= 16) return 4
  return 5
})

const gridImageSize = computed(() => {
  const cols = gridColumns.value
  const gap = 4
  const width = gridContainerWidth.value || 296
  return Math.floor((width - (cols - 1) * gap) / cols)
})

const gridImageStyle = computed(() => ({
  width: `${gridImageSize.value}px`,
  height: `${gridImageSize.value}px`
}))

const toggleButtonClass =
  'flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-base-foreground text-base-background shadow-[1px_1px_8px_0px_rgba(0,0,0,0.4)] transition-colors hover:bg-base-foreground/90'

const navButtonClass =
  'flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-secondary-background text-component-node-foreground-secondary transition-colors'

watch(galleryImages, (images) => {
  thumbnailRefs.value = thumbnailRefs.value.slice(0, images.length)
  if (images.length === 0) {
    activeIndex.value = 0
    return
  }
  if (activeIndex.value >= images.length) {
    activeIndex.value = images.length - 1
  }
  if (images.length <= 1) {
    displayMode.value = 'single'
  }
})

function getItemSrc(item: GalleryImage): string {
  return item.itemImageSrc || item.src || ''
}

function getItemThumbnail(item: GalleryImage): string {
  return item.thumbnailImageSrc || item.itemImageSrc || item.src || ''
}

function getItemAlt(item: GalleryImage, index: number): string {
  return (
    item.alt ||
    `${t('g.galleryImage')} ${index + 1} of ${galleryImages.value.length}`
  )
}

function handleImageLoad(event: Event) {
  if (!(event.target instanceof HTMLImageElement)) return
  const { naturalWidth, naturalHeight } = event.target
  if (naturalWidth && naturalHeight) {
    imageDimensions.value = `${naturalWidth} x ${naturalHeight}`
  }
}

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
  imageDimensions.value = null
  scrollToActive()
}

function goToPrevious() {
  activeIndex.value =
    activeIndex.value > 0
      ? activeIndex.value - 1
      : galleryImages.value.length - 1
  imageDimensions.value = null
  scrollToActive()
}

function goToNext() {
  activeIndex.value =
    activeIndex.value < galleryImages.value.length - 1
      ? activeIndex.value + 1
      : 0
  imageDimensions.value = null
  scrollToActive()
}

function selectFromGrid(index: number) {
  activeIndex.value = index
  imageDimensions.value = null
  displayMode.value = 'single'
}
</script>
