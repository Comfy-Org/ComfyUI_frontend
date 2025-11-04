<template>
  <div class="flex flex-col items-center gap-1">
    <MediaTitle :file-name="fileName" />
    <div class="flex items-center text-xs text-zinc-400">
      <span v-if="asset.dimensions"
        >{{ asset.dimensions?.width }}x{{ asset.dimensions?.height }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getFilenameDetails } from '@/utils/formatUtil'

import type { AssetContext, AssetMeta } from '../schemas/mediaAssetSchema'
import MediaTitle from './MediaTitle.vue'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()

const fileName = computed(() => {
  return getFilenameDetails(asset.name).filename
})
</script>
