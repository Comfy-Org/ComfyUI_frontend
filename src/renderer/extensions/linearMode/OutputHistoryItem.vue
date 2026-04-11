<script setup lang="ts">
import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import type { ResultItemImpl } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import VideoPlayOverlay from '@/platform/assets/components/VideoPlayOverlay.vue'

const { output } = defineProps<{
  output: ResultItemImpl
}>()
</script>
<template>
  <img
    v-if="getMediaType(output) === 'images'"
    data-testid="linear-image-output"
    class="block size-10 rounded-sm bg-secondary-background object-cover"
    loading="lazy"
    width="40"
    height="40"
    :src="output.url"
  />
  <template v-else-if="getMediaType(output) === 'video'">
    <video
      data-testid="linear-video-output"
      class="pointer-events-none block size-10 rounded-sm bg-secondary-background object-cover"
      preload="metadata"
      width="40"
      height="40"
      :src="output.url"
    />
    <VideoPlayOverlay size="sm" />
  </template>
  <i
    v-else
    :class="cn(mediaTypes[getMediaType(output)]?.iconClass, 'block size-10')"
  />
</template>
