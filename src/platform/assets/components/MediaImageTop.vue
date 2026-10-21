<template>
  <div class="relative size-full overflow-hidden rounded-sm bg-muted">
    <img
      v-if="!error"
      :src="asset.src"
      :alt="getAssetDisplayName(asset)"
      class="size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
      :draggable="false"
    />
    <div v-else class="flex size-full items-center justify-center bg-muted">
      <i class="pi pi-image text-3xl text-muted-foreground" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { whenever } from '@vueuse/core'

import { useImageQuiet } from '@/composables/useImageQuiet'
import type { AssetMeta } from '@/platform/assets/schemas/mediaAssetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const emit = defineEmits<{
  'image-loaded': [width: number, height: number]
}>()

const { state, error, isReady } = useImageQuiet({
  src: asset.src ?? '',
  alt: getAssetDisplayName(asset)
})

whenever(
  () =>
    isReady.value && state.value?.naturalWidth && state.value?.naturalHeight,
  () =>
    emit('image-loaded', state.value!.naturalWidth, state.value!.naturalHeight)
)
</script>
