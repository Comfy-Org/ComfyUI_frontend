<template>
  <div
    class="relative h-full w-full overflow-hidden rounded bg-zinc-200 dark-theme:bg-zinc-700/50"
  >
    <img
      v-if="shouldShowImage"
      :src="asset.src"
      :alt="asset.name"
      class="h-full w-full object-contain"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-zinc-200 dark-theme:bg-zinc-700/50"
    >
      <i class="pi pi-image text-3xl text-smoke-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed, watch } from 'vue'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const emit = defineEmits<{
  'image-loaded': [dimensions: { width: number; height: number }]
}>()

// Use same image loading logic as AssetCard
const { state, error, isReady } = useImage({
  src: asset.src ?? '',
  alt: asset.name
})

const shouldShowImage = computed(() => asset.src && !error.value)

// Emit dimensions when image is loaded
watch(isReady, (ready) => {
  if (ready && state.value) {
    const width = state.value.naturalWidth
    const height = state.value.naturalHeight
    if (width && height) {
      emit('image-loaded', { width, height })
    }
  }
})
</script>
