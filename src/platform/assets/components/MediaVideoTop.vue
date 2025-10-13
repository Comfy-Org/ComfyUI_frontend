<template>
  <div
    class="relative h-full w-full overflow-hidden rounded bg-black"
    @mouseenter="showControls = true"
    @mouseleave="showControls = false"
  >
    <video
      ref="videoRef"
      :controls="showControls"
      preload="none"
      :poster="asset.preview_url"
      class="relative h-full w-full object-contain"
      @click.stop
      @play="onVideoPlay"
      @pause="onVideoPause"
    >
      <source :src="asset.src || ''" />
    </video>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

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
const showControls = ref(true)

watch(showControls, (controlsVisible) => {
  emit('videoControlsChanged', controlsVisible)
})

onMounted(() => {
  emit('videoControlsChanged', showControls.value)
})

const onVideoPlay = () => {
  showControls.value = true
  emit('videoPlayingStateChanged', true)
}

const onVideoPause = () => {
  emit('videoPlayingStateChanged', false)
}
</script>
