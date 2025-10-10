<template>
  <div class="relative h-full w-full overflow-hidden rounded">
    <!-- Show video player if playing -->
    <div
      v-if="showVideoPlayer"
      class="h-full w-full bg-black"
      @mouseenter="showControls = true"
      @mouseleave="showControls = false"
    >
      <video
        ref="videoRef"
        :controls="showControls"
        class="relative h-full w-full object-contain"
        @click.stop
      >
        <source :src="asset.src || ''" />
      </video>
    </div>

    <!-- Show thumbnail initially with DefaultThumbnail (lazy loading) -->
    <div v-else class="relative h-full w-full" @click="handlePlayClick">
      <LazyImage
        v-if="asset.thumbnailUrl"
        :src="asset.thumbnailUrl"
        :alt="asset.name"
        :container-class="'aspect-square'"
        :image-class="'object-cover w-full h-full'"
      />

      <!-- Simple play button overlay -->
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/30"
      >
        <IconButton type="secondary" size="md" @click="handlePlayClick">
          <i class="icon-[comfy--play] size-4" />
        </IconButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import LazyImage from '@/components/common/LazyImage.vue'

import type { AssetContext, AssetMeta } from '../../types'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()

const emit = defineEmits<{
  play: [assetId: string]
  videoPlayingStateChanged: [isPlaying: boolean]
}>()

const videoRef = ref<HTMLVideoElement>()

const showVideoPlayer = ref(false)
const showControls = ref(false)

watch(showControls, (controlsVisible) => {
  if (showVideoPlayer.value) {
    emit('videoPlayingStateChanged', controlsVisible)
  }
})

const handlePlayClick = () => {
  showVideoPlayer.value = true
  emit('play', asset.id)
}

// Cleanup on unmount to prevent memory leaks
onBeforeUnmount(() => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
    videoRef.value.load()
  }
})
</script>
