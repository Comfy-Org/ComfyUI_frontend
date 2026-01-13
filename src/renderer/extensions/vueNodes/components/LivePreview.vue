<template>
  <div v-if="imageUrl" class="flex h-full min-h-16 w-full min-w-16 flex-col">
    <!-- Image Container -->
    <div
      class="relative h-88 w-full grow overflow-hidden rounded-[5px] bg-node-component-surface"
    >
      <!-- Error State -->
      <div
        v-if="imageError"
        class="text-pure-white flex h-full w-full flex-col items-center justify-center text-center"
      >
        <i-lucide:image-off class="mb-1 size-8 text-smoke-500" />
        <p class="text-xs text-smoke-400">{{ $t('g.imageFailedToLoad') }}</p>
      </div>

      <!-- Main Image -->
      <img
        v-else
        :src="imageUrl"
        :alt="$t('g.liveSamplingPreview')"
        class="pointer-events-none h-full w-full object-contain object-center"
        @load="handleImageLoad"
        @error="handleImageError"
      />
    </div>

    <!-- Image Dimensions -->
    <div class="text-node-component-header-text mt-1 text-center text-xs">
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
