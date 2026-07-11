<template>
  <div
    v-if="imageUrls.length > 0"
    class="image-preview group relative flex size-full min-h-55 min-w-16 flex-col justify-center px-2"
    @keydown="handleKeyDown"
  >
    <!-- Grid View -->
    <div
      v-if="viewMode === 'grid'"
      ref="gridEl"
      data-testid="image-grid"
      class="relative grid w-full flex-1 gap-1 rounded-sm p-1 contain-size"
      :style="{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }"
    >
      <Button
        v-for="(url, index) in gridImageUrls"
        :key="index"
        size="unset"
        class="ring-ring overflow-hidden rounded-none p-0 hover:ring-1 focus-visible:ring-2"
        :aria-label="
          $t('g.viewImageOfTotal', {
            index: index + 1,
            total: imageUrls.length
          })
        "
        @click="handleGridClick(index)"
      >
        <img
          v-if="!isHdrImageUrl(imageUrls[index])"
          :src="url"
          :alt="`${$t('g.galleryThumbnail')} ${index + 1}`"
          draggable="false"
          class="pointer-events-none size-full object-contain"
          @load="updateAspectRatio($event, index)"
        />
        <div
          v-else
          class="flex size-full flex-col items-center justify-center gap-1 text-base-foreground"
        >
          <i class="icon-[lucide--sun] size-6" />
          <span class="text-xs">{{ $t('hdrViewer.hdrImage') }}</span>
        </div>
      </Button>
    </div>

    <!-- Gallery View (Image Wrapper) -->
    <div
      v-if="viewMode === 'gallery'"
      ref="galleryPanelEl"
      class="group/panel relative flex min-h-0 w-full flex-1 cursor-pointer overflow-hidden rounded-sm bg-transparent"
      tabindex="0"
      role="region"
      :aria-roledescription="$t('g.imageGallery')"
      :aria-label="$t('g.imagePreview')"
      :aria-busy="showLoader"
    >
      <!-- Error State -->
      <div
        v-if="imageError"
        role="alert"
        class="flex size-full flex-1 flex-col items-center justify-around self-center py-8 text-center text-base-foreground"
      >
        <i class="mb-2 icon-[lucide--image-off] size-12 text-base-foreground" />
        <p class="text-sm text-base-foreground">
          {{ $t('g.imageFailedToLoad') }}
        </p>
        <p class="mt-1 text-xs text-base-foreground">
          {{ getImageFilename(currentImageUrl) }}
        </p>
      </div>
      <!-- Loading State -->
      <div
        v-if="showLoader && !imageError && !currentImageIsHdr"
        class="size-full"
      >
        <Skeleton class="size-full rounded-sm" />
      </div>
      <button
        v-if="!imageError && currentImageIsHdr"
        type="button"
        data-testid="hdr-open-button"
        class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 border-0 bg-transparent text-base-foreground"
        @click="openHdrViewer(currentImageUrl)"
      >
        <i class="icon-[lucide--sun] size-12" />
        <span class="text-sm">{{ $t('hdrViewer.hdrImage') }}</span>
        <span
          class="rounded-md bg-base-foreground px-3 py-1.5 text-sm text-base-background"
        >
          {{ $t('hdrViewer.openInHdrViewer') }}
        </span>
      </button>
      <!-- Main Image -->
      <img
        v-if="!imageError && !currentImageIsHdr"
        data-testid="main-image"
        :src="currentImageUrl"
        :alt="imageAltText"
        draggable="false"
        class="pointer-events-none absolute inset-0 block size-full object-contain"
        @load="handleImageLoad"
        @error="handleImageError"
      />

      <!-- Floating Action Buttons (appear on hover and focus) -->
      <div
        class="actions invisible absolute top-2 right-2 flex gap-1 group-focus-within/panel:visible group-hover/panel:visible"
      >
        <!-- Mask/Edit Button -->
        <button
          v-if="!hasMultipleImages && !imageError && !currentImageIsHdr"
          :class="actionButtonClass"
          :title="$t('g.editOrMaskImage')"
          :aria-label="$t('g.editOrMaskImage')"
          @click="handleEditMask"
        >
          <i-comfy:mask class="size-4" />
        </button>

        <!-- Download Button -->
        <button
          v-if="!imageError"
          :class="actionButtonClass"
          :title="$t('g.downloadImage')"
          :aria-label="$t('g.downloadImage')"
          @click="handleDownload"
        >
          <i class="icon-[lucide--download] size-4" />
        </button>

        <!-- Back to Grid Button -->
        <button
          v-if="hasMultipleImages"
          :class="actionButtonClass"
          :title="$t('g.viewGrid')"
          :aria-label="$t('g.viewGrid')"
          @click="viewMode = 'grid'"
        >
          <i class="icon-[lucide--layout-grid] size-4" />
        </button>
      </div>
    </div>

    <!-- Image Dimensions (gallery mode only) -->
    <div
      v-if="viewMode === 'gallery' && !currentImageIsHdr"
      class="pt-2 text-center text-xs text-base-foreground"
    >
      <span
        v-if="imageError"
        class="text-error"
        data-testid="error-loading-image"
      >
        {{ $t('g.errorLoadingImage') }}
      </span>
      <span v-else-if="showLoader" class="text-base-foreground">
        {{ $t('g.loading') }}...
      </span>
      <span v-else>
        {{ actualDimensions || $t('g.calculatingDimensions') }}
      </span>
    </div>

    <!-- Multiple Images Navigation (gallery mode only) -->
    <div
      v-if="viewMode === 'gallery' && hasMultipleImages"
      class="flex flex-wrap items-center justify-center gap-1 pt-4"
    >
      <!-- Back to Grid button -->
      <button
        class="mr-1 flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-base-foreground/50 transition-colors hover:text-base-foreground"
        :title="$t('g.viewGrid')"
        :aria-label="$t('g.viewGrid')"
        @click="viewMode = 'grid'"
      >
        <i class="icon-[lucide--layout-grid] size-3.5" />
      </button>

      <!-- Navigation Dots -->
      <button
        v-for="(_, index) in imageUrls"
        :key="index"
        :class="getNavigationDotClass(index)"
        :aria-current="index === currentIndex ? 'true' : undefined"
        :aria-label="
          $t('g.viewImageOfTotal', {
            index: index + 1,
            total: imageUrls.length
          })
        "
        @click="setCurrentIndex(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useTimeoutFn } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { openHdrViewer } from '@/services/hdrViewerService'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@/types/nodeId'
import { isHdrImageUrl } from '@/utils/hdrFormatUtil'
import { getGridThumbnailUrl } from '@/utils/imageUtil'
import { resolveNode } from '@/utils/litegraphUtil'
import { cn } from '@comfyorg/tailwind-utils'

interface ImagePreviewProps {
  /** Array of image URLs to display */
  readonly imageUrls: readonly string[]
  /** Optional node ID for context-aware actions */
  readonly nodeId?: NodeId
}

const { imageUrls, nodeId } = defineProps<ImagePreviewProps>()

const { t } = useI18n()
const maskEditor = useMaskEditor()
const nodeOutputStore = useNodeOutputStore()
const toastStore = useToastStore()

const actionButtonClass =
  'flex h-8 min-h-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-base-foreground p-2 text-base-background shadow-interface transition-colors duration-200 hover:bg-base-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2'

type ViewMode = 'gallery' | 'grid'

function defaultViewMode(urls: readonly string[]): ViewMode {
  return urls.length > 1 ? 'grid' : 'gallery'
}

const { width: gridWidth, height: gridHeight } = useElementSize(
  useTemplateRef('gridEl')
)

const currentIndex = ref(0)
const viewMode = ref<ViewMode>(defaultViewMode(imageUrls))
const galleryPanelEl = ref<HTMLDivElement>()
const actualDimensions = ref<string | null>(null)
const imageError = ref(false)
const showLoader = ref(false)
const imageAspectRatio = ref(1)

const { start: startDelayedLoader, stop: stopDelayedLoader } = useTimeoutFn(
  () => {
    showLoader.value = true
  },
  250,
  // Make sure it doesnt run on component mount
  { immediate: false }
)

const currentImageUrl = computed(() => imageUrls[currentIndex.value] ?? '')
const currentImageIsHdr = computed(() => isHdrImageUrl(currentImageUrl.value))
const gridImageUrls = computed(() => imageUrls.map(getGridThumbnailUrl))
const hasMultipleImages = computed(() => imageUrls.length > 1)
const imageAltText = computed(() =>
  t('g.viewImageOfTotal', {
    index: currentIndex.value + 1,
    total: imageUrls.length
  })
)
const gridCols = computed(() => {
  const bias = gridWidth.value / gridHeight.value / imageAspectRatio.value
  return Math.max(Math.round(Math.sqrt(imageUrls.length * bias)), 1)
})

watch(
  () => imageUrls,
  (newUrls, oldUrls) => {
    // Only reset state if URLs actually changed (not just array reference)
    const urlsChanged =
      !oldUrls ||
      newUrls.length !== oldUrls.length ||
      newUrls.some((url, i) => url !== oldUrls[i])

    if (!urlsChanged) return

    // Reset current index if it's out of bounds
    if (currentIndex.value >= newUrls.length) {
      currentIndex.value = 0
    }

    // Reset loading and error states when URLs change
    actualDimensions.value = null

    viewMode.value = defaultViewMode(newUrls)
    imageError.value = false
    if (newUrls.length > 0) startDelayedLoader()
  },
  { immediate: true }
)

function handleImageLoad(event: Event) {
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  stopDelayedLoader()
  showLoader.value = false
  imageError.value = false
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }

  if (nodeId) {
    nodeOutputStore.syncLegacyNodeImgs(nodeId, img, currentIndex.value)
  }
}

function updateAspectRatio(event: Event, index: number) {
  if (!(event.target instanceof HTMLImageElement) || index !== 0) return
  const { naturalWidth, naturalHeight } = event.target
  if (naturalWidth && naturalHeight) {
    imageAspectRatio.value = naturalWidth / naturalHeight
  }
}

function handleImageError() {
  stopDelayedLoader()
  showLoader.value = false
  imageError.value = true
  actualDimensions.value = null
}

function handleEditMask() {
  if (!nodeId) return
  const node = resolveNode(nodeId)
  if (!node) return
  maskEditor.openMaskEditor(node)
}

function handleDownload() {
  try {
    downloadFile(currentImageUrl.value)
  } catch {
    toastStore.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('g.failedToDownloadImage')
    })
  }
}

function setCurrentIndex(index: number) {
  if (currentIndex.value === index) return
  if (index >= 0 && index < imageUrls.length) {
    const urlChanged = imageUrls[index] !== currentImageUrl.value
    currentIndex.value = index
    imageError.value = false
    if (urlChanged) startDelayedLoader()
  }
}

async function openImageInGallery(index: number) {
  setCurrentIndex(index)
  viewMode.value = 'gallery'
  await nextTick()
  galleryPanelEl.value?.focus()
}

function handleGridClick(index: number) {
  const url = imageUrls[index]
  if (isHdrImageUrl(url)) {
    openHdrViewer(url)
    return
  }
  void openImageInGallery(index)
}

function getNavigationDotClass(index: number) {
  return cn(
    'size-2 cursor-pointer rounded-full border-0 p-0 transition-all duration-200',
    index === currentIndex.value
      ? 'bg-base-foreground'
      : 'bg-base-foreground/50 hover:bg-base-foreground/80'
  )
}

function handleKeyDown(event: KeyboardEvent) {
  if (
    event.key === 'Escape' &&
    viewMode.value === 'gallery' &&
    hasMultipleImages.value
  ) {
    event.preventDefault()
    viewMode.value = 'grid'
    return
  }

  if (imageUrls.length <= 1 || viewMode.value === 'grid') return

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      setCurrentIndex(
        currentIndex.value > 0 ? currentIndex.value - 1 : imageUrls.length - 1
      )
      break
    case 'ArrowRight':
      event.preventDefault()
      setCurrentIndex(
        currentIndex.value < imageUrls.length - 1 ? currentIndex.value + 1 : 0
      )
      break
    case 'Home':
      event.preventDefault()
      setCurrentIndex(0)
      break
    case 'End':
      event.preventDefault()
      setCurrentIndex(imageUrls.length - 1)
      break
  }
}

function getImageFilename(url: string): string {
  if (!url) return t('g.imageDoesNotExist')
  try {
    return new URL(url).searchParams.get('filename') || t('g.unknownFile')
  } catch {
    return t('g.imageDoesNotExist')
  }
}
</script>
