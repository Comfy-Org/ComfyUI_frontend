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

// Native media controls live in user-agent shadow DOM, so a click on them is
// indistinguishable from a click on the video itself: same `target`, same
// `composedPath()`. Position is the only signal, and the strip is roughly the
// bottom 38px in WebKit and the bottom 64px in Chromium. Use the larger
// value: over-guarding a few extra px on WebKit is a minor inconvenience,
// under-guarding on Chromium defeats this fix entirely.
const NATIVE_CONTROLS_STRIP_PX = 64

function isOverNativeControls(event: MouseEvent, video: HTMLVideoElement) {
  const { bottom, height } = video.getBoundingClientRect()
  if (height <= 0) return false
  const stripHeight = Math.min(NATIVE_CONTROLS_STRIP_PX, height / 2)
  const distanceFromBottom = bottom - event.clientY
  return distanceFromBottom >= 0 && distanceFromBottom <= stripHeight
}

async function onVideoClick(event: MouseEvent) {
  const video = videoElement.value
  if (!video) return

  // Clicks elsewhere on the video keep bubbling so modifier-select still works.
  if (shouldShowControls.value) {
    if (isOverNativeControls(event, video)) event.stopPropagation()
    return
  }

  if (event.shiftKey || event.metaKey || event.ctrlKey) return

  if (video.paused || video.ended) {
    await video.play().catch(() => {})
    return
  }

  video.pause()
}
</script>
