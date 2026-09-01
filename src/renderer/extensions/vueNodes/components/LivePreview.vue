<template>
  <template v-if="imageUrl">
    <div
      v-if="imageError"
      class="text-pure-white flex size-full flex-col items-center justify-center text-center"
    >
      <i-lucide:image-off class="mb-1 size-8 text-smoke-500" />
      <p class="text-xs text-smoke-400">{{ $t('g.imageFailedToLoad') }}</p>
    </div>
    <img
      v-else
      :src="imageUrl"
      :alt="$t('g.liveSamplingPreview')"
      class="pointer-events-none min-h-55 w-full flex-1 object-contain contain-size"
      @load="handleImageLoad"
      @error="imageError = true"
    />
    <div class="text-node-component-header-text mt-1 text-center text-xs">
      {{
        imageError
          ? $t('g.errorLoadingImage')
          : actualDimensions || $t('g.calculatingDimensions')
      }}
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface LivePreviewProps {
  imageUrl: string
}

const props = defineProps<LivePreviewProps>()

// Cache last successfully loaded dimensions so the placeholder text does not
// flicker back to "Calculating dimensions" each time `imageUrl` changes during
// live preview streaming. Update only when a new image is ready, never on
// URL change alone.
const cachedWidth = ref<number | null>(null)
const cachedHeight = ref<number | null>(null)
const imageError = ref(false)

function handleImageLoad(event: Event) {
  if (!(event.target instanceof HTMLImageElement)) return
  const img = event.target
  imageError.value = false
  if (img.naturalWidth && img.naturalHeight) {
    cachedWidth.value = img.naturalWidth
    cachedHeight.value = img.naturalHeight
  }
}

watch(
  () => props.imageUrl,
  () => {
    imageError.value = false
  }
)

const actualDimensions = computed(() =>
  cachedWidth.value && cachedHeight.value
    ? `${cachedWidth.value} x ${cachedHeight.value}`
    : null
)
</script>
