<template>
  <div
    class="relative size-full overflow-hidden rounded bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      ref="videoRef"
      :controls="shouldShowControls"
      preload="none"
      :poster="asset.preview_url"
      class="relative size-full object-contain"
      @click.stop
      @play="onVideoPlay"
      @pause="onVideoPause"
      @ended="onVideoEnded"
    >
      <source :src="asset.src || ''" />
    </video>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import type { AssetContext, AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
  context: AssetContext
}>()

const emit = defineEmits<{
  play: [assetId: string]
  videoPlayingStateChanged: [isPlaying: boolean]
  videoControlsChanged: [showControls: boolean]
}>()

const videoRef = ref<HTMLVideoElement>()
const isHovered = ref(false)
const isPlaying = ref(false)

// Always show controls when not playing, hide/show based on hover when playing
const shouldShowControls = computed(() => !isPlaying.value || isHovered.value)

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

const onVideoEnded = () => {
  isPlaying.value = false
  emit('videoPlayingStateChanged', false)
}
</script>
