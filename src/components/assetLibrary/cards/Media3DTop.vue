<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <div
      class="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-100 dark-theme:bg-zinc-700"
    >
      <i class="pi pi-box text-3xl text-zinc-700 dark-theme:text-zinc-200" />
      <span>{{ $t('3D Model') }}</span>
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
