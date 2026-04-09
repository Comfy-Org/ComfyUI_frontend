<script setup lang="ts">
import { computed } from 'vue'

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

const mediaType = computed(() => getMediaType(output))
</script>
<template>
  <div
    v-if="mediaType === 'image_compare' && output.compareImages"
    class="relative block size-10 overflow-hidden rounded-sm bg-secondary-background"
  >
    <img
      v-if="output.compareImages.before[0]"
      class="absolute inset-0 size-full object-cover"
      loading="lazy"
      :src="output.compareImages.before[0].url"
      :style="{ clipPath: 'inset(0 50% 0 0)' }"
    />
    <img
      v-if="output.compareImages.after[0]"
      class="absolute inset-0 size-full object-cover"
      loading="lazy"
      :src="output.compareImages.after[0].url"
      :style="{ clipPath: 'inset(0 0 0 50%)' }"
    />
  </div>
  <img
    v-else-if="mediaType === 'images'"
    data-testid="linear-image-output"
    class="block size-10 rounded-sm bg-secondary-background object-cover"
    loading="lazy"
    width="40"
    height="40"
    :src="output.url"
  />
  <template v-else-if="mediaType === 'video'">
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
  <i v-else :class="cn(mediaTypes[mediaType]?.iconClass, 'block size-10')" />
</template>
