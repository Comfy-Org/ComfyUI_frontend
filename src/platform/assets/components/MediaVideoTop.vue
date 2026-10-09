<template>
  <div
    class="relative size-full overflow-hidden rounded-sm bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      v-if="status !== 'failed'"
      ref="videoElement"
      :key="src"
      data-testid="media-asset-video"
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
import { useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useRetryableMediaSrc } from '@/composables/media/useRetryableMediaSrc'
import type { AssetMeta } from '../schemas/mediaAssetSchema'

import VideoPlayOverlay from './VideoPlayOverlay.vue'

const {
  asset,
  showNativeControls = true,
  previewStartedAt = null
} = defineProps<{
  asset: AssetMeta
  showNativeControls?: boolean
  previewStartedAt?: number | null
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
const isHovered = ref(false)
const isPlaying = ref(false)
let playbackToken = 0
let metadataWait: { token: number; startedAt: number } | null = null

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

const stopInPlacePreview = (video: HTMLVideoElement) => {
  video.pause()
  if (video.currentTime <= 0) return
  try {
    video.currentTime = 0
  } catch {
    // Metadata may not be available yet.
  }
}

const seekToSelectionStart = (video: HTMLVideoElement, startedAt: number) => {
  const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000)
  const { duration } = video
  if (!Number.isFinite(duration) || duration <= 0) return
  const nextTime = elapsedSeconds % duration
  if (Math.abs(video.currentTime - nextTime) <= 0.2) return
  try {
    video.currentTime = nextTime
  } catch {
    // Ignore seek failures before the media is seekable.
  }
}

const startSelectionPlayback = (video: HTMLVideoElement, startedAt: number) => {
  if ((previewStartedAt ?? null) !== startedAt) return
  if (status.value === 'failed') return
  seekToSelectionStart(video, startedAt)
  void video.play().catch(() => {})
}

const onLoadedMetadata = () => {
  const video = videoElement.value
  const wait = metadataWait
  if (!video || !wait) return
  if (wait.token !== playbackToken) return
  metadataWait = null
  startSelectionPlayback(video, wait.startedAt)
}

useEventListener(videoElement, 'loadedmetadata', onLoadedMetadata)

const onDurationChange = () => {
  const video = videoElement.value
  const startedAt = previewStartedAt ?? null
  if (!video || startedAt == null || status.value === 'failed') return
  seekToSelectionStart(video, startedAt)
}

useEventListener(videoElement, 'durationchange', onDurationChange)

const beginSelectionPreview = (video: HTMLVideoElement, startedAt: number) => {
  const token = ++playbackToken
  if (video.readyState > 0) {
    metadataWait = null
    startSelectionPlayback(video, startedAt)
    return
  }

  metadataWait = { token, startedAt }
}

// Join time only. A load-status watch pauses click-to-play on retry.
watch(
  [() => previewStartedAt ?? null, videoElement],
  ([startedAt, video], previous) => {
    if (!video) return
    const previousStartedAt = previous?.[0] ?? null
    if (startedAt == null) {
      playbackToken++
      metadataWait = null
      if (previousStartedAt != null) stopInPlacePreview(video)
      return
    }
    beginSelectionPreview(video, startedAt)
  },
  { flush: 'sync' }
)

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
