<template>
  <div v-if="imageUrl" class="w-full h-full min-w-16 min-h-16 flex flex-col">
    <!-- Image Container -->
    <div
      class="relative rounded-[5px] overflow-hidden bg-node-component-surface w-full max-h-64 grow"
    >
      <!-- Error State -->
      <div
        v-if="imageError"
        class="w-full h-full flex flex-col items-center justify-center text-pure-white text-center"
      >
        <i-lucide:image-off class="size-8 mb-1 text-gray-500" />
        <p class="text-xs text-gray-400">{{ $t('g.imageFailedToLoad') }}</p>
      </div>

      <!-- Main Image -->
      <img
        v-else
        :src="imageUrl"
        :alt="$t('g.liveSamplingPreview')"
        class="w-full h-full object-contain object-center pointer-events-none"
        @load="handleImageLoad"
        @error="handleImageError"
      />
    </div>

    <!-- Image Dimensions -->
    <div class="text-node-component-header-text text-xs text-center mt-1">
      {{
        imageError
          ? $t('g.errorLoadingImage')
          : actualDimensions || $t('g.calculatingDimensions')
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface LivePreviewProps {
  /** Image URL to display */
  imageUrl: string | null
}

const props = defineProps<LivePreviewProps>()

const actualDimensions = ref<string | null>(null)
const imageError = ref(false)

watch(
  () => props.imageUrl,
  () => {
    // Reset states when URL changes
    actualDimensions.value = null
    imageError.value = false
  }
)

const handleImageLoad = (event: Event) => {
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  imageError.value = false
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }
}

const handleImageError = () => {
  imageError.value = true
  actualDimensions.value = null
}
</script>
