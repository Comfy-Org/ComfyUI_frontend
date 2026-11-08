<template>
  <div
    v-if="items.length"
    class="image-preview group relative flex size-full min-w-16 flex-col justify-center px-2"
    :style="{ minHeight: `${IMAGE_PREVIEW_CONTENT_MIN_HEIGHT}px` }"
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
        v-for="(url, index) in gridUrls"
        :key="index"
        size="unset"
        class="overflow-hidden rounded-none p-0 ring-border hover:ring-1 focus-visible:ring-2"
        :aria-label="
          $t('g.viewImageOfTotal', { index: index + 1, total: items.length })
        "
        @click="openImageInGallery(index)"
      >
        <div
          v-if="url && !failedHdrPreviews[index]"
          class="pointer-events-none relative size-full"
        >
          <img
            :src="url"
            :alt="`${$t('g.galleryThumbnail')} ${index + 1}`"
            draggable="false"
            decoding="async"
            class="size-full object-contain"
            @load="updateAspectRatio($event, index)"
            @error="failedHdrPreviews[index] = isHdrResult(items[index])"
          />
        </div>
        <div
          v-else
          class="flex size-full flex-col items-center justify-center gap-1 text-foreground"
        >
          <i class="icon-[lucide--sun] size-6" />
        </div>
      </Button>
      <div
        v-if="canExportOutputs"
        class="invisible absolute top-2 right-2 group-focus-within:visible group-hover:visible"
      >
        <Button
          variant="inverted"
          size="icon"
          class="shadow-md"
          :title="$t('g.downloadImages')"
          :aria-label="$t('g.downloadImages')"
          @click="handleExportOutputs"
        >
          <i class="icon-[lucide--folder-down]" />
        </Button>
      </div>
    </div>

    <!-- Gallery View (Image Wrapper) -->
    <div
      v-if="viewMode === 'gallery'"
      ref="galleryPanelEl"
      class="group/panel relative flex min-h-0 w-full flex-1 cursor-pointer overflow-hidden rounded-sm"
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
        class="flex size-full flex-1 flex-col items-center justify-around self-center py-8 text-center text-foreground"
      >
        <i class="mb-2 icon-[lucide--image-off] size-12" />
        <p class="text-sm">
          {{ $t('g.imageFailedToLoad') }}
        </p>
        <p class="mt-1 text-xs">
          {{ items[currentIndex].filename }}
        </p>
      </div>
      <!-- Loading State -->
      <div
        v-if="
          showLoader &&
          !imageError &&
          displayUrls[currentIndex] &&
          !failedHdrPreviews[currentIndex]
        "
        role="status"
        :aria-label="t('g.loading')"
        class="size-full"
      >
        <Skeleton class="size-full rounded-sm" />
      </div>
      <img
        v-if="
          !imageError &&
          displayUrls[currentIndex] &&
          !failedHdrPreviews[currentIndex]
        "
        :key="imageKeys[currentIndex]"
        data-testid="main-image"
        :src="mainImageSrc"
        :data-file-url="isHdr ? resultItemUrl(items[currentIndex]) : undefined"
        :data-full-src="isDownscaled ? currentImageUrl : undefined"
        decoding="async"
        :alt="
          t('g.viewImageOfTotal', {
            index: currentIndex + 1,
            total: items.length
          })
        "
        draggable="false"
        class="pointer-events-none absolute inset-0 block size-full object-contain"
        @load="handleImageLoad"
        @error="handleImageError(displayUrls[currentIndex])"
      />
      <button
        v-else-if="!imageError && isHdr"
        type="button"
        data-testid="hdr-open-button"
        class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 border-0 bg-transparent text-foreground"
        @click="openHdrViewer(resultItemUrl(items[currentIndex]))"
      >
        <i class="icon-[lucide--sun] size-12" />
        <span class="text-sm">{{ $t('hdrViewer.hdrImage') }}</span>
        <span
          class="rounded-md bg-foreground px-3 py-1.5 text-sm text-background"
        >
          {{ $t('hdrViewer.openInHdrViewer') }}
        </span>
      </button>
      <!-- Floating Action Buttons (appear on hover and focus) -->
      <div
        class="actions invisible absolute top-2 right-2 flex gap-1 group-focus-within/panel:visible group-hover/panel:visible"
      >
        <!-- Mask/Edit Button -->
        <Button
          v-if="!hasMultipleImages && !imageError && !isHdr"
          variant="inverted"
          size="icon"
          class="shadow-md"
          :title="$t('g.editOrMaskImage')"
          :aria-label="$t('g.editOrMaskImage')"
          @click="handleEditMask"
        >
          <i-comfy:mask class="size-4" />
        </Button>

        <Button
          v-if="!imageError && isHdr"
          variant="inverted"
          size="icon"
          class="shadow-md"
          :title="$t('hdrViewer.openInHdrViewer')"
          :aria-label="$t('hdrViewer.openInHdrViewer')"
          @click="openHdrViewer(resultItemUrl(items[currentIndex]))"
        >
          <i class="icon-[lucide--sun]" />
        </Button>

        <!-- Layer Editor Button -->
        <Button
          v-if="hasMultipleImages && !imageError"
          variant="inverted"
          size="icon"
          class="shadow-md"
          :title="$t('g.openLayerEditor')"
          :aria-label="$t('g.openLayerEditor')"
          @click="handleOpenLayerEditor"
        >
          <i class="icon-[lucide--layers]" />
        </Button>

        <!-- Download Button -->
        <Button
          v-if="!imageError"
          variant="inverted"
          size="icon"
          class="shadow-md"
          :title="$t('g.downloadImage')"
          :aria-label="$t('g.downloadImage')"
          @click="handleDownload"
        >
          <i class="icon-[lucide--download]" />
        </Button>

        <!-- Back to Grid Button -->
        <Button
          v-if="hasMultipleImages"
          variant="inverted"
          size="icon"
          class="shadow-md"
          :title="$t('g.viewGrid')"
          :aria-label="$t('g.viewGrid')"
          @click="viewMode = 'grid'"
        >
          <i class="icon-[lucide--layout-grid]" />
        </Button>
      </div>
    </div>

    <!-- Image Dimensions (gallery mode only) -->
    <div
      v-if="
        viewMode === 'gallery' &&
        (!isHdr ||
          (displayUrls[currentIndex] && !failedHdrPreviews[currentIndex]))
      "
      class="pt-2 text-center text-foreground"
    >
      <span
        v-if="imageError"
        class="text-destructive"
        data-testid="error-loading-image"
      >
        {{ $t('g.errorLoadingImage') }}
      </span>
      <span v-else-if="showLoader"> {{ $t('g.loading') }}... </span>
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
        class="mr-1 flex cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0.5 text-foreground/50 transition-colors hover:text-foreground"
        :title="$t('g.viewGrid')"
        :aria-label="$t('g.viewGrid')"
        @click="viewMode = 'grid'"
      >
        <i class="icon-[lucide--layout-grid] size-3.5" />
      </button>

      <!-- Navigation Dots -->
      <button
        v-for="(_, index) in displayUrls"
        :key="index"
        :class="getNavigationDotClass(index)"
        :aria-current="index === currentIndex ? 'true' : undefined"
        :aria-label="
          $t('g.viewImageOfTotal', {
            index: index + 1,
            total: displayUrls.length
          })
        "
        @click="setCurrentIndex(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computedAsync,
  useElementSize,
  useObjectUrl,
  useTimeoutFn
} from '@vueuse/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import Button from '@comfyorg/design-system/button/Button'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useMaskEditor } from '@/renderer/extensions/maskEditor/composables/useMaskEditor'
import { useNodeOutputsExport } from '@/platform/assets/composables/useNodeOutputsExport'
import { useTelemetry } from '@comfyorg/telemetry'
import { describeImageLoadFailure } from '@/platform/telemetry/imageFailureDiagnostics'
import { openHdrViewer } from '@/services/hdrViewerService'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { getGridThumbnailUrl } from '@/utils/imageUtil'
import { resolveNode } from '@/utils/litegraphUtil'
import { isHdrResult } from '@/utils/resultItem'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemPreviewUrl, resultItemUrl } from '@/utils/resultItemUrl'
import { cn } from '@comfyorg/tailwind-utils'

import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useImagePreviewStore } from '@/renderer/extensions/vueNodes/stores/imagePreviewStore'
import { IMAGE_PREVIEW_CONTENT_MIN_HEIGHT } from './imagePreviewLayout'

const DISPLAY_MAX_EDGE = 1024
const PRELOAD_MIN_SCALE = 1

interface ImagePreviewProps {
  readonly items: readonly AugmentedResultItem[]
  readonly nodeId?: NodeId
}

const { items, nodeId } = defineProps<ImagePreviewProps>()

const { t } = useI18n()
const maskEditor = useMaskEditor()
const nodeOutputStore = useNodeOutputStore()
const { getDisplayImage } = useImagePreviewStore()
const { hasMultipleOutputs, showOutputsExportDialog } = useNodeOutputsExport()
const toast = useToast()

type ViewMode = 'gallery' | 'grid'

function defaultViewMode(items: readonly unknown[]): ViewMode {
  return items.length > 1 ? 'grid' : 'gallery'
}

const { width: gridWidth, height: gridHeight } = useElementSize(
  useTemplateRef('gridEl')
)

const currentIndex = ref(0)
const viewMode = ref<ViewMode>(defaultViewMode(items))
const galleryPanelEl = ref<HTMLDivElement>()
const actualDimensions = ref<string | null>(null)
const imageError = ref(false)
const showLoader = ref(false)
const imageAspectRatio = ref(1)
const failedHdrPreviews = ref<boolean[]>([])

const { start: startDelayedLoader, stop: stopDelayedLoader } = useTimeoutFn(
  () => {
    showLoader.value = true
  },
  250,
  // Make sure it doesnt run on component mount
  { immediate: false }
)

const displayUrls = computed(() =>
  items.map((item) => resultItemPreviewUrl(item, { fullRes: true }))
)
const imageKeys = computed(() =>
  items.map(
    (item, index) => `${resultItemUrl(item)}\n${displayUrls.value[index]}`
  )
)
const gridUrls = computed(() =>
  items.map((item) => getGridThumbnailUrl(resultItemPreviewUrl(item)))
)
const isHdr = computed(() => isHdrResult(items[currentIndex.value]))

const currentImageUrl = computed(
  () => displayUrls.value[currentIndex.value] ?? ''
)
const displayImage = computedAsync(async () => {
  const source = currentImageUrl.value
  if (viewMode.value !== 'gallery' || !source || isHdr.value) return undefined
  return getDisplayImage(source, DISPLAY_MAX_EDGE)
})
const currentDisplayImage = computed(() =>
  displayImage.value?.source === currentImageUrl.value
    ? displayImage.value
    : undefined
)
const displayImageUrl = useObjectUrl(() => currentDisplayImage.value?.blob)
const mainImageSrc = computed(() =>
  isHdr.value
    ? currentImageUrl.value
    : currentDisplayImage.value?.blob
      ? displayImageUrl.value
      : currentDisplayImage.value?.source
)
const isDownscaled = computed(() => !!currentDisplayImage.value?.blob)
const hasMultipleImages = computed(() => items.length > 1)
const canExportOutputs = computed(() => {
  const node = nodeId ? resolveNode(nodeId) : undefined
  return !!node && hasMultipleOutputs(node)
})
const gridCols = computed(() => {
  const bias = gridWidth.value / gridHeight.value / imageAspectRatio.value
  return Math.max(Math.round(Math.sqrt(items.length * bias)), 1)
})

const { camera } = useTransformState()
const isZoomedIn = computed(() => camera.z >= PRELOAD_MIN_SCALE)
const preloadUrls = computed(() => {
  if (!hasMultipleImages.value || !isZoomedIn.value) return []
  const count = items.length
  const candidates =
    viewMode.value === 'grid'
      ? items
      : [
          items[(currentIndex.value + 1) % count],
          items[(currentIndex.value - 1 + count) % count]
        ]
  return candidates
    .filter((item) => !isHdrResult(item))
    .map((item) => resultItemPreviewUrl(item, { fullRes: true }))
})
watch(
  preloadUrls,
  (urls) => {
    for (const url of urls) void getDisplayImage(url, DISPLAY_MAX_EDGE)
  },
  { immediate: true }
)

watch(
  imageKeys,
  (newUrls, oldUrls) => {
    const urlsChanged =
      !oldUrls ||
      newUrls.length !== oldUrls.length ||
      newUrls.some((url, i) => url !== oldUrls[i])
    if (!urlsChanged) return

    if (currentIndex.value >= newUrls.length) currentIndex.value = 0
    actualDimensions.value = null
    viewMode.value = defaultViewMode(newUrls)
    imageError.value = false
    failedHdrPreviews.value = []
    if (newUrls.length > 0) startDelayedLoader()
  },
  { immediate: true }
)

let isUnmounted = false
onBeforeUnmount(() => {
  isUnmounted = true
})

function handleImageLoad(event: Event) {
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  stopDelayedLoader()
  showLoader.value = false
  imageError.value = false
  const { width, height } = currentDisplayImage.value?.originalSize ?? {
    width: img.naturalWidth,
    height: img.naturalHeight
  }
  if (width && height) actualDimensions.value = `${width} x ${height}`

  if (nodeId && !isUnmounted) {
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

async function handleImageError(failedUrl: string) {
  stopDelayedLoader()
  showLoader.value = false
  if (isHdr.value) {
    failedHdrPreviews.value[currentIndex.value] = true
    return
  }
  imageError.value = true
  actualDimensions.value = null

  const metadata = await describeImageLoadFailure(failedUrl)
  useTelemetry()?.trackImageLoadFailed(metadata)
}

function handleEditMask() {
  if (!nodeId) return
  const node = resolveNode(nodeId)
  if (!node) return
  maskEditor.openMaskEditor(node)
}

async function handleOpenLayerEditor() {
  if (!nodeId) return
  const node = resolveNode(nodeId)
  if (!node) return
  const { useLayerEditor } =
    await import('@/renderer/extensions/layerEditor/composables/useLayerEditor')
  useLayerEditor().openLayerEditor(node)
}

function handleDownload() {
  try {
    downloadFile(resultItemUrl(items[currentIndex.value]), undefined, 'node_preview')
  } catch {
    toast.error(t('g.error'), {
      description: t('g.failedToDownloadImage')
    })
  }
}

function handleExportOutputs() {
  if (!nodeId) return
  const node = resolveNode(nodeId)
  if (!node) return
  showOutputsExportDialog(node)
}

function setCurrentIndex(index: number) {
  if (currentIndex.value === index) return
  if (index >= 0 && index < items.length) {
    const oldUrl = displayUrls.value[currentIndex.value]
    currentIndex.value = index
    imageError.value = false
    if (displayUrls.value[index] !== oldUrl) startDelayedLoader()
  }
}

async function openImageInGallery(index: number) {
  setCurrentIndex(index)
  viewMode.value = 'gallery'
  await nextTick()
  galleryPanelEl.value?.focus()
}

function getNavigationDotClass(index: number) {
  return cn(
    'size-2 cursor-pointer rounded-full border-0 p-0 transition-all duration-200',
    index === currentIndex.value
      ? 'bg-foreground'
      : 'bg-foreground/50 hover:bg-foreground/80'
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

  if (items.length <= 1 || viewMode.value === 'grid') return

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      setCurrentIndex(
        currentIndex.value > 0 ? currentIndex.value - 1 : items.length - 1
      )
      break
    case 'ArrowRight':
      event.preventDefault()
      setCurrentIndex(
        currentIndex.value < items.length - 1 ? currentIndex.value + 1 : 0
      )
      break
    case 'Home':
      event.preventDefault()
      setCurrentIndex(0)
      break
    case 'End':
      event.preventDefault()
      setCurrentIndex(items.length - 1)
      break
  }
}
</script>
