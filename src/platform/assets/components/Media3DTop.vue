<template>
  <div ref="containerRef" class="relative size-full overflow-hidden rounded-sm">
    <img
      v-if="thumbnailSrc"
      :src="thumbnailSrc"
      :alt="asset?.name"
      class="size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
    />
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-2 bg-modal-card-placeholder-background transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
    >
      <i class="icon-[lucide--box] text-3xl text-muted-foreground" />
      <span class="text-sm text-base-foreground">
        {{ $t('assetBrowser.media.threeDModelPlaceholder') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import {
  findServerPreviewUrl,
  isAssetPreviewSupported
} from '../utils/assetPreviewUtil'

const { asset } = defineProps<{ asset: AssetMeta }>()

const containerRef = ref<HTMLElement>()
const thumbnailSrc = ref<string | null>(null)
const hasAttempted = ref(false)

useIntersectionObserver(containerRef, ([entry]) => {
  if (entry?.isIntersecting && !hasAttempted.value) {
    hasAttempted.value = true
    void loadThumbnail()
  }
})

async function loadThumbnail() {
  if (asset?.preview_id && asset?.preview_url) {
    thumbnailSrc.value = asset.preview_url
    return
  }

  if (!asset?.src) return

  if (asset.name && isAssetPreviewSupported()) {
    const serverPreviewUrl = await findServerPreviewUrl(asset.name)
    if (serverPreviewUrl) {
      thumbnailSrc.value = serverPreviewUrl
    }
  }
}

function revokeThumbnail() {
  if (thumbnailSrc.value?.startsWith('blob:')) {
    URL.revokeObjectURL(thumbnailSrc.value)
  }
  thumbnailSrc.value = null
}

watch(
  () => asset?.src,
  () => {
    if (hasAttempted.value) {
      hasAttempted.value = false
      revokeThumbnail()
    }
  }
)

onBeforeUnmount(revokeThumbnail)
</script>
