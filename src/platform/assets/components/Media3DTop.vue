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
      <i
        :class="
          cn(
            'text-3xl text-muted-foreground',
            loading
              ? 'icon-[lucide--loader-circle] animate-spin'
              : 'icon-[lucide--box]'
          )
        "
      />
      <span v-if="!loading" class="text-sm text-base-foreground">
        {{ $t('assetBrowser.media.threeDModelPlaceholder') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'
import { generate3DThumbnail } from './thumbnail3dRenderer'

const { asset } = defineProps<{ asset: AssetMeta }>()

const containerRef = ref<HTMLElement>()
const thumbnailSrc = ref<string | null>(null)
const loading = ref(false)
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

  loading.value = true
  try {
    const result = await generate3DThumbnail(asset.src)
    if (!result) return

    thumbnailSrc.value = result.objectUrl

    if (asset.id && assetService.isAssetAPIEnabled()) {
      void persistThumbnail(asset.id, asset.name, result.blob)
    }
  } catch {
    thumbnailSrc.value = null
  } finally {
    loading.value = false
  }
}

async function persistThumbnail(
  assetId: string,
  modelName: string,
  blob: Blob
) {
  try {
    const dataUrl = await blobToDataUrl(blob)
    const uploaded = await assetService.uploadAssetFromBase64({
      data: dataUrl,
      name: `${modelName}_preview.png`
    })

    await assetService.updateAsset(assetId, {
      preview_id: uploaded.id
    })
  } catch {
    // Non-critical — client still shows the rendered thumbnail
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
      loading.value = false
    }
  }
)

onBeforeUnmount(revokeThumbnail)
</script>
