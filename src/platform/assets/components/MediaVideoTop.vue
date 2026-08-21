<template>
  <div
    class="relative size-full overflow-hidden rounded-sm bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      ref="videoElement"
      :controls="shouldShowControls"
      preload="metadata"
      muted
      loop
      playsinline
      class="relative size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
      @click="onVideoClick"
      @play="onVideoPlay"
      @pause="onVideoPause"
    >
      <source
        v-if="asset.src"
        :src="asset.src"
        :type="asset.mime_type ?? undefined"
      />
    </video>
    <VideoPlayOverlay :visible="!isPlaying" size="md" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

import VideoPlayOverlay from './VideoPlayOverlay.vue'

const { asset, showNativeControls = true } = defineProps<{
  asset: AssetMeta
  showNativeControls?: boolean
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
const isHovered = ref(false)
const isPlaying = ref(false)

// Show native controls only while actively playing and hovered.
const shouldShowControls = computed(
  () => showNativeControls && isPlaying.value && isHovered.value
)

const onVideoPlay = () => {
  isPlaying.value = true
}

const onVideoPause = () => {
  isPlaying.value = false
}

async function onVideoClick(event: MouseEvent) {
  if (
    event.shiftKey ||
    event.metaKey ||
    event.ctrlKey ||
    shouldShowControls.value
  ) {
    return
  }

  const video = videoElement.value
  if (!video) return

  if (video.paused || video.ended) {
    await video.play().catch(() => {})
    return
  }

  video.pause()
}
</script>
