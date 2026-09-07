<script setup lang="ts">
import { computed } from 'vue'

import {
  getMediaType,
  mediaTypes
} from '@/renderer/extensions/linearMode/mediaTypes'
import type { AugmentedResultItem } from '@/stores/resultItem'
import { resultItemUrl } from '@/stores/resultItem'
import { cn } from '@comfyorg/tailwind-utils'

import VideoPlayOverlay from '@/platform/assets/components/VideoPlayOverlay.vue'

const { output } = defineProps<{
  output: AugmentedResultItem
}>()

const url = computed(() => resultItemUrl(output))
</script>
<template>
  <img
    v-if="getMediaType(output) === 'images'"
    data-testid="linear-image-output"
    class="block size-10 rounded-sm bg-secondary-background object-cover"
    loading="lazy"
    width="40"
    height="40"
    :src="url"
  />
  <template v-else-if="getMediaType(output) === 'video'">
    <video
      data-testid="linear-video-output"
      class="pointer-events-none block size-10 rounded-sm bg-secondary-background object-cover"
      preload="metadata"
      width="40"
      height="40"
      :src="url"
    />
    <VideoPlayOverlay size="sm" />
  </template>
  <i
    v-else
    :class="cn(mediaTypes[getMediaType(output)]?.iconClass, 'block size-10')"
  />
</template>
