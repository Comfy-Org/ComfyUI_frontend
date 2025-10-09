<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <LazyImage
      v-if="asset.src"
      :src="asset.src"
      :alt="asset.name"
      :container-class="'aspect-square'"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
    >
      <i class="pi pi-image text-3xl text-gray-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import LazyImage from '@/components/common/LazyImage.vue'
import type { AssetContext, AssetMeta } from '@/types/media.types'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()
</script>
