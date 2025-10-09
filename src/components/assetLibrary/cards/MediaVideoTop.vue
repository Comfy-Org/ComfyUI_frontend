<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <!-- Show video player if playing -->
    <div v-if="showVideoPlayer" class="h-full w-full bg-black">
      <video
        controls
        autoplay
        class="relative h-full w-full object-contain"
        @click.stop
      >
        <source :src="asset.src || asset.thumbnailUrl || ''" />
      </video>
    </div>

    <!-- Show thumbnail initially with DefaultThumbnail (lazy loading) -->
    <div v-else class="relative h-full w-full" @click="handlePlayClick">
      <LazyImage
        v-if="asset.thumbnailUrl"
        :src="asset.thumbnailUrl"
        :alt="asset.name"
        :container-class="'aspect-square'"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-gray-100 dark-theme:bg-gray-800"
      >
        <i class="icon-[lucide--play] text-white" />
      </div>

      <!-- Simple play button overlay -->
      <div
        class="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/10 hover:bg-black/20"
        @click="handlePlayClick"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-black/60"
        >
          <i class="icon-[lucide--play] text-white" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import LazyImage from '@/components/common/LazyImage.vue'
import type { AssetContext, AssetMeta } from '@/types/media.types'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()

const emit = defineEmits<{
  download: [assetId: string]
  play: [assetId: string]
  view: [assetId: string]
  copy: [assetId: string]
  copyJobId: [jobId: string]
}>()

// State for showing video player
const showVideoPlayer = ref(false)

// Handle play button click
function handlePlayClick() {
  showVideoPlayer.value = true
  emit('play', asset.id)
}
</script>
