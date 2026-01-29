<template>
  <div
    class="relative size-full overflow-hidden rounded bg-black"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <video
      :controls="shouldShowControls"
      preload="metadata"
      muted
      loop
      playsinline
      :poster="asset.preview_url ?? undefined"
      class="relative size-full object-contain transition-transform duration-300 group-hover:scale-105 group-data-[selected=true]:scale-105"
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

import type { AssetMeta } from '../schemas/mediaAssetSchema'

const { asset } = defineProps<{
  asset: AssetMeta
}>()

const emit = defineEmits<{
  videoPlayingStateChanged: [isPlaying: boolean]
  videoControlsChanged: [showControls: boolean]
}>()

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
