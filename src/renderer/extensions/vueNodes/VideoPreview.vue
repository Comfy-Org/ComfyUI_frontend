<template>
  <div
    v-if="imageUrls.length > 0"
    class="video-preview relative group flex flex-col items-center"
    tabindex="0"
    role="region"
    :aria-label="$t('g.videoPreview')"
    data-capture-node="true"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeyDown"
  >
    <!-- Video Wrapper -->
    <div
      class="relative rounded-[5px] overflow-hidden w-full max-w-[352px] bg-[#262729]"
    >
      <!-- Error State -->
      <div
        v-if="videoError"
        class="w-full h-[352px] flex flex-col items-center justify-center text-white text-center bg-gray-800/50"
      >
        <i class="icon-[lucide--video-off] w-12 h-12 mb-2 text-gray-400" />
        <p class="text-sm text-gray-300">{{ $t('g.videoFailedToLoad') }}</p>
        <p class="text-xs text-gray-400 mt-1">
          {{ getVideoFilename(currentVideoUrl) }}
        </p>
      </div>

      <!-- Loading State -->
      <Skeleton
        v-else-if="isLoading"
        class="w-full h-[352px]"
        border-radius="5px"
      />

      <!-- Main Video -->
      <video
        v-else
        :src="currentVideoUrl"
        class="w-full h-[352px] object-contain block"
        controls
        loop
        playsinline
        @loadeddata="handleVideoLoad"
        @error="handleVideoError"
      />

      <!-- Floating Action Buttons (appear on hover) -->
      <div v-if="isHovered" class="actions absolute top-2 right-2 flex gap-1">
        <!-- Download Button -->
        <button
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0 cursor-pointer"
          :title="$t('g.downloadVideo')"
          :aria-label="$t('g.downloadVideo')"
          @click="handleDownload"
        >
          <i class="icon-[lucide--download] w-4 h-4" />
        </button>

        <!-- Close Button -->
        <button
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0 cursor-pointer"
          :title="$t('g.removeVideo')"
          :aria-label="$t('g.removeVideo')"
          @click="handleRemove"
        >
          <i class="icon-[lucide--x] w-4 h-4" />
        </button>
      </div>

      <!-- Multiple Videos Navigation -->
      <div
        v-if="hasMultipleVideos"
        class="absolute bottom-2 left-2 right-2 flex justify-center gap-1"
      >
        <button
          v-for="(_, index) in imageUrls"
          :key="index"
          :class="getNavigationDotClass(index)"
          :aria-label="
            $t('g.viewVideoOfTotal', {
              index: index + 1,
              total: imageUrls.length
            })
          "
          @click="setCurrentIndex(index)"
        />
      </div>
    </div>

    <div class="relative">
      <!-- Video Dimensions -->
      <div class="text-white text-xs text-center mt-2">
        <span v-if="videoError" class="text-red-400">
          {{ $t('g.errorLoadingVideo') }}
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
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

import LODFallback from './components/LODFallback.vue'

interface VideoPreviewProps {
  /** Array of video URLs to display */
  readonly imageUrls: readonly string[] // Named imageUrls for consistency with parent components
  /** Optional node ID for context-aware actions */
  readonly nodeId?: string
}

const props = defineProps<VideoPreviewProps>()

const { t } = useI18n()
const nodeOutputStore = useNodeOutputStore()

// Component state
const currentIndex = ref(0)
const isHovered = ref(false)
const actualDimensions = ref<string | null>(null)
const videoError = ref(false)
const isLoading = ref(false)

// Computed values
const currentVideoUrl = computed(() => props.imageUrls[currentIndex.value])
const hasMultipleVideos = computed(() => props.imageUrls.length > 1)

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
    videoError.value = false
    isLoading.value = false
  },
  { deep: true }
)

// Event handlers
const handleVideoLoad = (event: Event) => {
  if (!event.target || !(event.target instanceof HTMLVideoElement)) return
  const video = event.target
  isLoading.value = false
  videoError.value = false
  if (video.videoWidth && video.videoHeight) {
    actualDimensions.value = `${video.videoWidth} x ${video.videoHeight}`
  }
}

const handleVideoError = () => {
  isLoading.value = false
  videoError.value = true
  actualDimensions.value = null
}

const handleDownload = () => {
  try {
    downloadFile(currentVideoUrl.value)
  } catch (error) {
    useToast().add({
      severity: 'error',
      summary: 'Error',
      detail: t('g.failedToDownloadVideo'),
      life: 3000,
      group: 'video-preview'
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
    videoError.value = false
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

const getVideoFilename = (url: string): string => {
  try {
    return new URL(url).searchParams.get('filename') || 'Unknown file'
  } catch {
    return 'Invalid URL'
  }
}
</script>
