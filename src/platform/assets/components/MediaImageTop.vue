<template>
  <div class="relative size-full overflow-hidden rounded">
    <LazyImage
      v-if="asset.src"
      :src="asset.src"
      :alt="asset.name"
      :container-class="'aspect-square'"
      :image-class="'w-full h-full object-cover'"
    />
    <div
      v-else
      class="dark-theme:bg-zinc-700/50 flex size-full items-center justify-center bg-zinc-200"
    >
      <i class="pi pi-image text-smoke-400 text-3xl" />
    </div>
  </div>
</template>

<script setup lang="ts">
import LazyImage from '@/components/common/LazyImage.vue'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
}>()
</script>
