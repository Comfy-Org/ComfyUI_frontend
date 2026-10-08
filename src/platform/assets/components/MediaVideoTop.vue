<template>
  <div
    ref="containerElement"
    class="relative size-full overflow-hidden rounded-sm bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      v-if="status !== 'failed'"
      ref="videoElement"
      data-testid="media-asset-video"
      :aria-label="getAssetDisplayName(asset)"
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
import { getAssetDisplayName } from '../utils/assetMetadataUtils'

import VideoPlayOverlay from './VideoPlayOverlay.vue'

const { asset, showNativeControls = true } = defineProps<{
  asset: AssetMeta
  showNativeControls?: boolean
}>()

const containerElement = ref<HTMLDivElement | null>(null)
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

// Native media controls live in user-agent shadow DOM, so a click on them is
// indistinguishable from a click on the video itself: same `target`, same
// `composedPath()`. Position is the only signal, and the strip is roughly the
// bottom 38px in WebKit and the bottom 64px in Chromium. Use the larger
// value: over-guarding a few extra px on WebKit is a minor inconvenience,
// under-guarding on Chromium defeats this fix entirely. Measure the clipping
// container, not the video: the video is scaled while hovered, so its rect
// extends below the visible edge.
const NATIVE_CONTROLS_STRIP_PX = 64

function isOverNativeControls(event: MouseEvent, container: HTMLElement) {
  const { bottom, height } = container.getBoundingClientRect()
  if (height <= 0) return false
  const stripHeight = Math.min(NATIVE_CONTROLS_STRIP_PX, height / 2)
  const distanceFromBottom = bottom - event.clientY
  return distanceFromBottom >= 0 && distanceFromBottom <= stripHeight
}

function stopNativeControlsClick(event: MouseEvent) {
  const container = containerElement.value
  if (container && isOverNativeControls(event, container)) {
    event.stopPropagation()
  }
}

async function togglePlayback() {
  const video = videoElement.value
  if (!video) return

  if (video.paused || video.ended) {
    await video.play().catch(() => {})
    return
  }

  video.pause()
}

async function onVideoClick(event: MouseEvent) {
  if (shouldShowControls.value) {
    stopNativeControlsClick(event)
    return
  }

  if (event.shiftKey || event.metaKey || event.ctrlKey) return

  await togglePlayback()
}
</script>
