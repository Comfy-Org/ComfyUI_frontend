<template>
  <template v-if="imageUrl">
    <div
      v-if="imageError"
      class="flex size-full flex-col items-center justify-center text-center text-white"
    >
      <i-lucide:image-off class="mb-1 size-8 text-smoke-500" />
      <p class="text-muted-foreground">{{ $t('g.imageFailedToLoad') }}</p>
    </div>
    <img
      v-else
      :src="imageUrl"
      :alt="$t('g.liveSamplingPreview')"
      :class="
        cn(
          'pointer-events-none w-full flex-1 object-contain contain-size',
          fitsContainer ? 'min-h-0' : 'min-h-55'
        )
      "
      @load="handleImageLoad"
      @error="handleImageError"
    />
    <div class="mt-1 text-center text-foreground">
      {{
        imageError
          ? $t('g.errorLoadingImage')
          : actualDimensions || $t('g.calculatingDimensions')
      }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { imageUrl, fitsContainer = false } = defineProps<{
  imageUrl: string
  fitsContainer?: boolean
}>()

const actualDimensions = ref<string | null>(null)
const imageError = ref(false)

watch(
  () => imageUrl,
  () => {
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
