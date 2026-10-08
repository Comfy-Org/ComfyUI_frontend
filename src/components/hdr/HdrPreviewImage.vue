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

<script setup lang="ts">
import { computed, toValue } from 'vue'

import { useAssetsQuery } from '@/platform/assets/composables/useAssetsQuery'
import { isAssetPreviewSupported } from '@/platform/assets/utils/assetPreviewUtil'
import { getGeneratedPreviewUrl } from '@/platform/assets/utils/assetUrlUtil'

const { filename } = defineProps<{ filename: string | undefined }>()

const assetLists = isAssetPreviewSupported()
  ? [
      useAssetsQuery({ tags_any: ['input'] }),
      useAssetsQuery({ tags_any: ['output', 'temp'] })
    ]
  : []

const previewUrl = computed(() => {
  const asset = assetLists
    .flatMap((list) => toValue(list.items))
    .find(({ hash, name }) => hash === filename || name === filename)
  return asset ? getGeneratedPreviewUrl(asset) : ''
})
</script>
