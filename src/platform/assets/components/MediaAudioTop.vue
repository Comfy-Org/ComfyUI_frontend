<template>
  <div class="relative size-full overflow-hidden rounded">
    <div
      class="flex size-full flex-col items-center justify-center gap-2 bg-zinc-200 dark-theme:bg-zinc-700/50"
    >
      <i
        class="icon-[lucide--music] text-3xl text-zinc-600 dark-theme:text-zinc-200"
      />
      <span class="text-zinc-600 dark-theme:text-zinc-200">{{
        $t('Audio')
      }}</span>
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
