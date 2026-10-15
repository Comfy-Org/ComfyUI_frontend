<script setup lang="ts">
import { Music2 } from '@lucide/vue'

import type { PlaygroundExample } from '@/config/workshop-playground'
import { isVideoUrl, videoPosterUrl } from '@/config/workshop-playground'

defineProps<{
  example: PlaygroundExample
  alt: string
  videoPreload: 'metadata' | 'none'
}>()
</script>

<template>
  <video
    v-if="example.mediaKind === 'video' || isVideoUrl(example.outputUrl)"
    :src="videoPosterUrl(example.outputUrl)"
    :aria-label="alt"
    class="size-full object-cover"
    muted
    playsinline
    :preload="videoPreload"
    data-testid="example-video"
  />
  <Music2
    v-else-if="example.mediaKind === 'audio'"
    class="size-full px-3"
    aria-hidden="true"
  />
  <img
    v-else-if="example.outputUrl"
    :src="example.outputUrl"
    :alt
    class="size-full object-cover"
    loading="lazy"
    decoding="async"
  />
</template>
