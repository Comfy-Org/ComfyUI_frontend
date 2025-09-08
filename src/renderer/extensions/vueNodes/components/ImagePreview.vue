<template>
  <div
    v-if="imageUrls.length > 0"
    class="image-preview relative group flex flex-col items-center"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Image Wrapper -->
    <div
      class="relative rounded-[5px] overflow-hidden w-full max-w-[352px] bg-[#262729]"
    >
      <!-- Main Image -->
      <img
        :src="currentImageUrl"
        :alt="`Node output ${currentIndex + 1}`"
        class="w-full h-[352px] object-cover block"
        @load="handleImageLoad"
      />

      <!-- Floating Action Buttons (appear on hover) -->
      <div v-if="isHovered" class="actions absolute top-2 right-2 flex gap-1">
        <!-- Mask/Edit Button -->
        <button
          v-if="!hasMultipleImages"
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0"
          :title="$t('editOrMaskImage')"
          :aria-label="$t('editOrMaskImage')"
          @click="handleEditMask"
        >
          <i-lucide:venetian-mask class="w-4 h-4" />
        </button>

        <!-- Download Button -->
        <button
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0"
          :title="$t('downloadImage')"
          :aria-label="$t('downloadImage')"
          @click="handleDownload"
        >
          <i-lucide:download class="w-4 h-4" />
        </button>

        <!-- Close Button -->
        <button
          class="action-btn bg-white text-black hover:bg-gray-100 rounded-lg p-2 shadow-sm transition-all duration-200 border-0"
          :title="$t('removeImage')"
          :aria-label="$t('removeImage')"
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
          :class="[
            'w-2 h-2 rounded-full transition-all duration-200 border-0',
            index === currentIndex
              ? 'bg-white'
              : 'bg-white/50 hover:bg-white/80'
          ]"
          :aria-label="
            $t('viewImageOfTotal', {
              index: index + 1,
              total: imageUrls.length
            })
          "
          @click="setCurrentIndex(index)"
        />
      </div>
    </div>

    <!-- Image Dimensions -->
    <div class="text-white text-xs text-center mt-2">
      {{ actualDimensions || 'Loading...' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImagePreview } from '../composables/useImagePreview'

interface ImagePreviewProps {
  imageUrls: string[]
  nodeId?: string
}

const props = defineProps<ImagePreviewProps>()

const {
  currentIndex,
  isHovered,
  actualDimensions,
  currentImageUrl,
  hasMultipleImages,
  handleImageLoad,
  handleEditMask,
  handleDownload,
  handleRemove,
  setCurrentIndex
} = useImagePreview(props.imageUrls, props.nodeId)
</script>
