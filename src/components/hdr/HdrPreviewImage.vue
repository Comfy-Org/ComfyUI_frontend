<template>
  <div>
    <img
      v-if="previewUrl"
      :src="previewUrl"
      :alt="filename"
      draggable="false"
      class="pointer-events-none size-full object-contain"
    />
    <slot v-else />
  </div>
</template>

<script lang="ts">
const resolvedPreviews = new Map<string, string>()
</script>

<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { toValue } from 'vue'

import {
  findServerPreviewUrl,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { useAssetsStore } from '@/stores/assetsStore'

const { filename } = defineProps<{ filename: string | undefined }>()

const assetsStore = useAssetsStore()

const previewUrl = computedAsync(async () => {
  void toValue(assetsStore.inputAssets.items)
  void toValue(assetsStore.outputAssets.items)
  if (!filename || !isAssetPreviewSupported()) return ''
  const cached = resolvedPreviews.get(filename)
  if (cached) return cached

  const url = await findServerPreviewUrl(filename)
  if (url) resolvedPreviews.set(filename, url)
  return url ?? ''
}, '')
</script>
