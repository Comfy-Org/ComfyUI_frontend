<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <div
      class="flex h-full w-full flex-col items-center justify-center gap-2 bg-interface-panel-card-surface"
    >
      <i class="icon-[lucide--music] text-3xl text-text-secondary" />
      <span class="text-text-secondary">{{ $t('Audio') }}</span>
    </div>
    <audio
      controls
      class="absolute bottom-0 left-0 w-full p-2"
      :src="asset.src"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import type { AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
}>()
</script>
