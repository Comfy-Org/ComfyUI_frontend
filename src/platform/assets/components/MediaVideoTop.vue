<template>
  <div
    class="relative size-full overflow-hidden rounded-sm bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      v-if="status !== 'failed'"
      ref="videoElement"
      :src="src"
      :controls="shouldShowControls"
      preload="metadata"
      muted
      loop
      playsinline
      class="relative size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
      @click="onVideoClick"
      @play="onVideoPlay"
      @pause="onVideoPause"
      @error="handleVideoError"
    ></video>
    <div
      v-else
      role="img"
      :aria-label="$t('g.videoFailedToLoad')"
      class="flex size-full items-center justify-center bg-modal-card-placeholder-background"
    >
      <i class="icon-[lucide--video-off] size-8 text-muted-foreground" />
    </div>
    <VideoPlayOverlay :visible="!isPlaying && status !== 'failed'" size="md" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useRetryableMediaSrc } from '@/composables/media/useRetryableMediaSrc'
import type { AssetMeta } from '../schemas/mediaAssetSchema'

import VideoPlayOverlay from './VideoPlayOverlay.vue'

const { asset, showNativeControls = true } = defineProps<{
  asset: AssetMeta
  showNativeControls?: boolean
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
const isHovered = ref(false)
const isPlaying = ref(false)

const { src, status, onError } = useRetryableMediaSrc(
  () => asset.src || undefined
)

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

const handleVideoError = () => {
  isPlaying.value = false
  onError()
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
