<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <LazyImage
      v-if="asset.src"
      :src="asset.src"
      :alt="asset.name"
      :container-class="'aspect-square'"
      :image-class="'w-full h-full object-cover'"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-interface-panel-card-surface"
    >
      <i class="pi pi-image text-3xl text-gray-400" />
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
