<template>
  <div class="flex flex-col gap-1">
    <MediaTitle :file-name="fileName" />
    <div class="flex gap-1.5 text-xs text-zinc-400">
      <span v-if="formattedTime">{{ formattedTime }}</span>
      <span v-if="asset.dimensions"
        >{{ asset.dimensions?.width }}x{{ asset.dimensions?.height }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getFilenameDetails } from '@/utils/formatUtil'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import MediaTitle from './MediaTitle.vue'

const { asset, formattedTime } = defineProps<{
  asset: AssetMeta
  formattedTime?: string
}>()

const fileName = computed(() => {
  return getFilenameDetails(asset.name).filename
})
</script>
