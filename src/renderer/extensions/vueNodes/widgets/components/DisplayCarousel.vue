<template>
  <div
    class="flex max-w-full flex-col rounded-lg bg-component-node-widget-background"
  >
    <!-- Single Mode -->
    <template v-if="displayMode === 'single'">
      <div class="flex flex-col gap-1 p-4">
        <!-- Main Image Container -->
        <div
          ref="imageContainerEl"
          class="relative flex cursor-pointer items-center justify-center"
          tabindex="0"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
          @focusin="isFocused = true"
          @focusout="handleFocusOut"
        >
          <img
            v-if="activeItem"
            :src="getItemSrc(activeItem)"
            :alt="getItemAlt(activeItem, activeIndex)"
            :class="
              cn(
                'h-auto w-full rounded-sm object-contain transition-opacity',
                showControls && 'opacity-50'
              )
            "
            @load="handleImageLoad"
          />

          <!-- Toggle to Grid (hover, top-left) -->
          <button
            v-if="showControls && galleryImages.length > 1"
            :class="toggleButtonClass"
            class="absolute top-2 left-2"
            :aria-label="t('g.switchToGridView')"
            @click="switchToGrid"
          >
            <i class="icon-[lucide--layout-grid] size-4" />
          </button>

          <!-- Action Buttons (hover, top-right) -->
          <div
            v-if="showControls && activeItem"
            class="absolute top-2 right-2 flex gap-1"
          >
            <button
              :class="actionButtonClass"
              :aria-label="t('g.editOrMaskImage')"
              @click="handleEditMask"
            >
              <i-comfy:mask class="size-4" />
            </button>
            <button
              :class="actionButtonClass"
              :aria-label="t('g.downloadImage')"
              @click="handleDownload"
            >
              <i class="icon-[lucide--arrow-down-to-line] size-4" />
            </button>
            <button
              :class="actionButtonClass"
              :aria-label="t('g.removeImage')"
              @click="handleRemove"
            >
              <i class="icon-[lucide--x] size-4" />
            </button>
          </div>
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
          v-if="showMultipleImages || showNavButtons"
          class="flex items-center justify-between"
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
            v-if="showMultipleImages"
            class="flex min-w-0 flex-1 items-center gap-1 overflow-x-hidden scroll-smooth py-1"
          >
            <div
              v-for="(item, index) in galleryImages"
              :key="getItemSrc(item)"
              :ref="(el) => setThumbnailRef(el as HTMLElement | null, index)"
              :class="
                cn(
                  'shrink-0 overflow-hidden rounded-lg p-1 transition-colors',
                  index === activeIndex
                    ? 'border-2 border-base-foreground'
                    : 'border-2 border-transparent'
                )
              "
              :aria-label="getItemAlt(item, index)"
            >
              <img
                :src="getItemThumbnail(item)"
                :alt="getItemAlt(item, index)"
                class="size-10 rounded-sm object-cover"
              />
            </div>
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
          class="relative h-72 overflow-x-hidden overflow-y-auto rounded-sm bg-component-node-background"
          tabindex="0"
        >
          <!-- Back to Single (top-left, always visible) -->
          <button
            :class="toggleButtonClass"
            class="sticky top-2 left-2 z-10 mt-2 ml-2"
            :aria-label="t('g.switchToSingleView')"
            @click="switchToSingle"
          >
            <i class="icon-[lucide--arrow-left] size-4" />
          </button>

          <div class="-mt-10 flex flex-wrap content-start gap-1">
            <button
              v-for="(item, index) in galleryImages"
              :key="getItemSrc(item)"
              class="size-14 shrink-0 cursor-pointer overflow-hidden border-0 p-0"
              :aria-label="getItemAlt(item, index)"
              @click="selectFromGrid(index)"
            >
              <img
                :src="getItemThumbnail(item)"
                :alt="getItemAlt(item, index)"
                class="size-full object-cover"
              />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { resolveNode } from '@/utils/litegraphUtil'
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
  showItemNavigators?: boolean
}

const value = defineModel<GalleryValue>({ required: true })

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<GalleryValue>
  nodeId?: string
}>()

const { t } = useI18n()
const maskEditor = useMaskEditor()
const nodeOutputStore = useNodeOutputStore()
const toastStore = useToastStore()

const activeIndex = ref(0)
const displayMode = ref<DisplayMode>('single')
const isHovered = ref(false)
const isFocused = ref(false)
const imageDimensions = ref<string | null>(null)
const thumbnailRefs = ref<(HTMLElement | null)[]>([])
const imageContainerEl = ref<HTMLDivElement>()
const gridContainerEl = ref<HTMLDivElement>()

const showControls = computed(() => isHovered.value || isFocused.value)

const options = computed<GalleryOptions>(() => widget.options ?? {})

const galleryImages = computed<GalleryImage[]>(() => {
  if (!value.value || !Array.isArray(value.value)) return []

  return value.value.flatMap((item) => {
    if (item === null || item === undefined) return []
    const image =
      typeof item === 'string'
        ? { itemImageSrc: item, thumbnailImageSrc: item }
        : item
    return image.itemImageSrc || image.src ? [image] : []
  })
})

const activeItem = computed(() => galleryImages.value[activeIndex.value])

const showMultipleImages = computed(() => galleryImages.value.length > 1)

const showNavButtons = computed(
  () => options.value.showItemNavigators !== false && showMultipleImages.value
)

const actionButtonClass =
  'flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-base-foreground text-base-background shadow-md transition-colors hover:bg-base-foreground/90'

const toggleButtonClass = actionButtonClass

const navButtonClass =
  'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-secondary-background text-component-node-foreground-secondary transition-colors'

watch(galleryImages, (images) => {
  thumbnailRefs.value = thumbnailRefs.value.slice(0, images.length)
  imageDimensions.value = null
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
    t('g.viewImageOfTotal', {
      index: index + 1,
      total: galleryImages.value.length
    })
  )
}

function handleFocusOut(event: FocusEvent) {
  const container =
    displayMode.value === 'single'
      ? imageContainerEl.value
      : gridContainerEl.value
  if (!container?.contains(event.relatedTarget as Node)) {
    isFocused.value = false
  }
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

function switchToGrid() {
  isHovered.value = false
  displayMode.value = 'grid'
}

function switchToSingle() {
  isHovered.value = false
  displayMode.value = 'single'
}

function selectFromGrid(index: number) {
  activeIndex.value = index
  imageDimensions.value = null
  isHovered.value = false
  displayMode.value = 'single'
  scrollToActive()
}

function handleEditMask() {
  if (!nodeId) return
  const node = resolveNode(Number(nodeId))
  if (!node) return
  maskEditor.openMaskEditor(node)
}

function handleDownload() {
  const src = activeItem.value ? getItemSrc(activeItem.value) : ''
  if (!src) return
  try {
    downloadFile(src)
  } catch {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('g.failedToDownloadImage')
    })
  }
}

function handleRemove() {
  if (!nodeId) return
  const node = resolveNode(Number(nodeId))
  nodeOutputStore.removeNodeOutputs(nodeId)
  if (node) {
    node.imgs = undefined
    const imageWidget = node.widgets?.find((w) => w.name === 'image')
    if (imageWidget) {
      imageWidget.value = ''
    }
  }
}
</script>
