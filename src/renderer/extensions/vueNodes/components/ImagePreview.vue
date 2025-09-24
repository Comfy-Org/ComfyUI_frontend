<template>
  <div
    v-if="imageUrls.length > 0"
    class="image-preview relative group flex flex-col items-center"
    tabindex="0"
    role="region"
    :aria-label="$t('g.imagePreview')"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeyDown"
  >
    <!-- Image Wrapper -->
    <div
      class="relative rounded-[5px] overflow-hidden w-full max-w-[352px] bg-[#262729]"
    >
      <!-- Error State -->
      <div
        v-if="imageError"
        class="w-full h-[352px] flex flex-col items-center justify-center text-white text-center bg-gray-800/50"
      >
        <i-lucide:image-off class="w-12 h-12 mb-2 text-gray-400" />
        <p class="text-sm text-gray-300">{{ $t('g.imageFailedToLoad') }}</p>
        <p class="text-xs text-gray-400 mt-1">{{ currentImageUrl }}</p>
      </div>

      <!-- Loading State -->
      <Skeleton
        v-else-if="isLoading"
        class="w-full h-[352px]"
        border-radius="5px"
      />

      <!-- Main Image -->
      <img
        v-else
        :src="currentImageUrl"
        :alt="imageAltText"
        class="w-full h-[352px] object-contain block"
        @load="handleImageLoad"
        @error="handleImageError"
      />

      <!-- Floating Action Buttons (appear on hover) -->
      <div v-if="isHovered" class="actions absolute top-2 right-2 flex gap-1">
        <!-- Mask/Edit Button -->
        <button
          v-if="!hasMultipleImages"
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0 cursor-pointer"
          :title="$t('g.editOrMaskImage')"
          :aria-label="$t('g.editOrMaskImage')"
          @click="handleEditMask"
        >
          <i-lucide:venetian-mask class="w-4 h-4" />
        </button>

        <!-- Download Button -->
        <button
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0 cursor-pointer"
          :title="$t('g.downloadImage')"
          :aria-label="$t('g.downloadImage')"
          @click="handleDownload"
        >
          <i-lucide:download class="w-4 h-4" />
        </button>

        <!-- Close Button -->
        <button
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0 cursor-pointer"
          :title="$t('g.removeImage')"
          :aria-label="$t('g.removeImage')"
          @click="handleRemove"
        >
          <i-lucide:x class="w-4 h-4" />
        </button>
      </div>

      <!-- Multiple Images Navigation -->
      <div
        v-if="hasMultipleImages"
        class="absolute bottom-2 left-2 right-2 flex justify-center gap-1"
      >
        <button
          v-for="(_, index) in imageUrls"
          :key="index"
          :class="getNavigationDotClass(index)"
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

    <div class="relative">
      <!-- Image Dimensions -->
      <div class="text-white text-xs text-center mt-2">
        <span v-if="imageError" class="text-red-400">
          {{ $t('g.errorLoadingImage') }}
        </span>
        <span v-else-if="isLoading" class="text-gray-400">
          {{ $t('g.loading') }}...
        </span>
        <span v-else>
          {{ actualDimensions || $t('g.calculatingDimensions') }}
        </span>
      </div>
      <LODFallback />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

import LODFallback from './LODFallback.vue'

interface ImagePreviewProps {
  /** Array of image URLs to display */
  readonly imageUrls: readonly string[]
  /** Optional node ID for context-aware actions */
  readonly nodeId?: string
}

const props = defineProps<ImagePreviewProps>()

const { t } = useI18n()
const commandStore = useCommandStore()
const nodeOutputStore = useNodeOutputStore()

// Component state
const currentIndex = ref(0)
const isHovered = ref(false)
const actualDimensions = ref<string | null>(null)
const imageError = ref(false)
const isLoading = ref(false)

// Computed values
const currentImageUrl = computed(() => props.imageUrls[currentIndex.value])
const hasMultipleImages = computed(() => props.imageUrls.length > 1)
const imageAltText = computed(() => `Node output ${currentIndex.value + 1}`)

// Watch for URL changes and reset state
watch(
  () => props.imageUrls,
  (newUrls) => {
    // Reset current index if it's out of bounds
    if (currentIndex.value >= newUrls.length) {
      currentIndex.value = 0
    }

    // Reset loading and error states when URLs change
    actualDimensions.value = null
    imageError.value = false
    isLoading.value = false
  },
  { deep: true }
)

// Event handlers
const handleImageLoad = (event: Event) => {
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  isLoading.value = false
  imageError.value = false
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }
}

const handleImageError = () => {
  isLoading.value = false
  imageError.value = true
  actualDimensions.value = null
}

const handleEditMask = () => {
  void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
}

const handleDownload = () => {
  try {
    downloadFile(currentImageUrl.value)
  } catch (error) {
    useToast().add({
      severity: 'error',
      summary: 'Error',
      detail: t('g.failedToDownloadImage'),
      life: 3000,
      group: 'image-preview'
    })
  }
}

const handleRemove = () => {
  if (!props.nodeId) return
  nodeOutputStore.removeNodeOutputs(props.nodeId)
}

const setCurrentIndex = (index: number) => {
  if (index >= 0 && index < props.imageUrls.length) {
    currentIndex.value = index
    actualDimensions.value = null
    isLoading.value = true
    imageError.value = false
  }
}

const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

const getNavigationDotClass = (index: number) => {
  return [
    'w-2 h-2 rounded-full transition-all duration-200 border-0 cursor-pointer',
    index === currentIndex.value ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
  ]
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (props.imageUrls.length <= 1) return

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      setCurrentIndex(
        currentIndex.value > 0
          ? currentIndex.value - 1
          : props.imageUrls.length - 1
      )
      break
    case 'ArrowRight':
      event.preventDefault()
      setCurrentIndex(
        currentIndex.value < props.imageUrls.length - 1
          ? currentIndex.value + 1
          : 0
      )
      break
    case 'Home':
      event.preventDefault()
      setCurrentIndex(0)
      break
    case 'End':
      event.preventDefault()
      setCurrentIndex(props.imageUrls.length - 1)
      break
  }
}
</script>
