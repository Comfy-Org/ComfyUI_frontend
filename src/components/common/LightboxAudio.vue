<template>
  <div
    class="m-auto w-[min(90vw,42rem)] rounded-2xl bg-base-background/80 p-8 backdrop-blur-sm"
  >
    <WaveAudioPlayer
      :src="url"
      variant="expanded"
      :height="120"
      :bar-count="80"
    />
  </div>
</template>

<script setup lang="ts">
import WaveAudioPlayer from '@/components/common/WaveAudioPlayer.vue'
import type { LightboxAudioItem } from '@/types/lightboxItem'

defineProps<Omit<LightboxAudioItem, 'kind'>>()
</script>
