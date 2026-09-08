<template>
  <div
    data-testid="media-video"
    class="relative size-full overflow-hidden rounded-sm bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      ref="videoElement"
      :aria-label="asset.name"
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
        data-testid="media-video-source"
        :src="asset.src"
        :type="asset.mime_type ?? undefined"
      />
    </video>
    <VideoPlayOverlay :visible="!isPlaying" size="md" />
    <!-- While native controls are hidden the <video> never enters the tab order. Clicks must keep bubbling so modified ones still reach the card's selection rules. -->
    <button
      v-if="asset.src && !shouldShowControls"
      type="button"
      draggable="false"
      :aria-label="isPlaying ? $t('g.pause') : $t('g.play')"
      class="absolute top-1/2 left-1/2 size-10 -translate-1/2 rounded-full focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
      @click="onVideoClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

import VideoPlayOverlay from './VideoPlayOverlay.vue'

const { asset, showNativeControls = true } = defineProps<{
  asset: AssetMeta
  showNativeControls?: boolean
}>()

const emit = defineEmits<{
  videoPlayingStateChanged: [isPlaying: boolean]
  videoControlsChanged: [showControls: boolean]
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
const isHovered = ref(false)
const isPlaying = ref(false)

// Show native controls only while actively playing and hovered.
const shouldShowControls = computed(
  () => showNativeControls && isPlaying.value && isHovered.value
)

watch(shouldShowControls, (controlsVisible) => {
  emit('videoControlsChanged', controlsVisible)
})

onMounted(() => {
  emit('videoControlsChanged', shouldShowControls.value)
})

const onVideoPlay = () => {
  isPlaying.value = true
  emit('videoPlayingStateChanged', true)
}

const onVideoPause = () => {
  isPlaying.value = false
  emit('videoPlayingStateChanged', false)
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
