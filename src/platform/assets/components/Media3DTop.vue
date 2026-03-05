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
import { generate3DThumbnail } from './thumbnail3dRenderer'

const { asset } = defineProps<{ asset: AssetMeta }>()

const containerRef = ref<HTMLElement>()
const thumbnailSrc = ref<string | null>(null)
const loading = ref(false)
const hasAttempted = ref(false)

useIntersectionObserver(containerRef, ([entry]) => {
  if (entry?.isIntersecting && !hasAttempted.value && asset?.src) {
    hasAttempted.value = true
    void renderThumbnail(asset.src)
  }
})

async function renderThumbnail(src: string) {
  loading.value = true
  try {
    thumbnailSrc.value = await generate3DThumbnail(src)
  } catch {
    thumbnailSrc.value = null
  } finally {
    loading.value = false
  }
}

function revokeThumbnail() {
  if (thumbnailSrc.value) {
    URL.revokeObjectURL(thumbnailSrc.value)
    thumbnailSrc.value = null
  }
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
