<template>
  <div class="flex flex-col items-center gap-1">
    <h3
      class="m-0 line-clamp-1 text-sm font-bold text-zinc-900 dark-theme:text-white"
      :title="asset.name"
    >
      {{ fileName }}
    </h3>
    <div class="flex items-center text-xs text-zinc-400">
      <span>{{ asset.dimensions?.width }}x{{ asset.dimensions?.height }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getFilenameDetails } from '@/utils/formatUtil'

import type { AssetContext, AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()

const fileName = computed(() => {
  return getFilenameDetails(asset.name).filename
})
</script>
