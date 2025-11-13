<template>
  <div class="relative size-full overflow-hidden rounded">
    <div
      class="dark-theme:bg-zinc-700/50 flex size-full flex-col items-center justify-center gap-2 bg-zinc-200"
    >
      <i
        class="icon-[lucide--music] dark-theme:text-zinc-200 text-3xl text-zinc-600"
      />
      <span class="dark-theme:text-zinc-200 text-zinc-600">{{
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
