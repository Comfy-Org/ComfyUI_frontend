<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <div
      v-if="asset.src"
      class="flex h-full w-full items-center justify-center p-4"
      :style="{
        backgroundImage: 'url(/assets/images/default-template.png)',
        backgroundRepeat: 'round'
      }"
    >
      <audio controls class="relative w-full" :src="asset.src" @click.stop />
    </div>
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
    >
      <i class="pi pi-audio text-3xl text-gray-400" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetContext, AssetMeta } from '@/types/media.types'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()
</script>
