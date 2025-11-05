<template>
  <div
    class="relative size-full overflow-hidden rounded bg-zinc-200 dark-theme:bg-zinc-700/50"
  >
    <img
      v-if="!error"
      :src="asset.src"
      :alt="asset.name"
      class="size-full object-contain"
    />
    <div
      v-else
      class="flex size-full items-center justify-center bg-zinc-200 dark-theme:bg-zinc-700/50"
    >
      <i class="pi pi-image text-3xl text-smoke-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage, whenever } from '@vueuse/core'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const emit = defineEmits<{
  'image-loaded': [width: number, height: number]
}>()

const { state, error, isReady } = useImage({
  src: asset.src ?? '',
  alt: asset.name
})

whenever(
  () =>
    isReady.value && state.value?.naturalWidth && state.value?.naturalHeight,
  () =>
    emit('image-loaded', state.value!.naturalWidth, state.value!.naturalHeight)
)
</script>
