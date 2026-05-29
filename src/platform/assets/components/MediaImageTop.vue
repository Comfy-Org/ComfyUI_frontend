<template>
  <div
    class="relative size-full overflow-hidden rounded-sm bg-modal-card-placeholder-background"
    @dblclick="emit('view')"
  >
    <img
      v-if="showImage"
      :src="asset.src"
      :alt="getAssetDisplayName(asset)"
      class="size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
      :draggable="false"
    />
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-2 bg-modal-card-placeholder-background p-3 text-center text-muted-foreground"
      data-testid="media-image-placeholder"
    >
      <i :class="cn('size-8', placeholderIcon)" />
      <span class="line-clamp-2 max-w-full text-xs break-all">
        {{ getAssetDisplayName(asset) }}
      </span>
      <span class="text-2xs text-muted-foreground/70">
        {{ $t('mediaAsset.previewNotAvailable') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useImage, whenever } from '@vueuse/core'
import { computed } from 'vue'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { getAssetDisplayName } from '../utils/assetMetadataUtils'
import { iconForMimeType } from '../utils/mediaIconUtil'

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const emit = defineEmits<{
  'image-loaded': [width: number, height: number]
  view: []
}>()

const { state, error, isReady } = useImage({
  src: asset.src ?? '',
  alt: getAssetDisplayName(asset)
})

const showImage = computed(() => !error.value && !!asset.src)

const placeholderIcon = computed(() => iconForMimeType(asset.mime_type))

whenever(
  () =>
    isReady.value && state.value?.naturalWidth && state.value?.naturalHeight,
  () =>
    emit('image-loaded', state.value!.naturalWidth, state.value!.naturalHeight)
)
</script>
