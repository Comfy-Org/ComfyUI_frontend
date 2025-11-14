<template>
  <div class="relative size-full overflow-hidden rounded">
    <div
      class="flex size-full flex-col items-center justify-center gap-2 bg-modal-card-background text-base-foreground"
    >
      <i class="icon-[lucide--music] text-3xl" />
      <span>{{ $t('assetBrowser.media.audioPlaceholder') }}</span>
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
