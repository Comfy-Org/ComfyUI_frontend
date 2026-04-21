<template>
  <div
    class="relative size-full overflow-hidden rounded-sm bg-modal-card-placeholder-background"
    @dblclick="emit('view')"
  >
    <img
      v-if="!error"
      :src="asset.src"
      :alt="getAssetDisplayName(asset)"
      class="size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
      :draggable="false"
    />
    <div
      v-else
      class="flex size-full items-center justify-center bg-modal-card-placeholder-background"
    >
      <i class="pi pi-image text-3xl text-muted-foreground" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage, whenever } from '@vueuse/core'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { getAssetDisplayName } from '../utils/assetMetadataUtils'

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const emit = defineEmits<{
  'image-loaded': [width: number, height: number]
  view: []
}>()

const { state, error, isReady } = useImage(
  {
    src: asset.src ?? '',
    alt: getAssetDisplayName(asset)
  },
  { onError: () => {} }
)

whenever(
  () =>
    isReady.value && state.value?.naturalWidth && state.value?.naturalHeight,
  () =>
    emit('image-loaded', state.value!.naturalWidth, state.value!.naturalHeight)
)
</script>
