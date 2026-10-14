<script setup lang="ts">
import { Music2 } from '@lucide/vue'

import type { GeneratedExample } from '@/config/models-catalogue'
import { videoPosterUrl } from '@/config/workshop-playground'

const { example, poster } = defineProps<{
  example: GeneratedExample
  poster?: string
}>()
</script>

<template>
  <video
    v-if="example.mediaKind === 'video'"
    :src="poster ? example.thumbnailUrl : videoPosterUrl(example.thumbnailUrl)"
    :poster
    muted
    playsinline
    :preload="poster ? 'none' : 'metadata'"
    aria-hidden="true"
    data-testid="workflow-example-video"
    class="aspect-4/3 w-full object-cover"
  />
  <span
    v-else-if="example.mediaKind === 'audio'"
    class="flex aspect-4/3 w-full items-center justify-center bg-transparency-white-t4"
  >
    <Music2 class="size-12 text-primary-warm-gray" aria-hidden="true" />
  </span>
  <img
    v-else
    :src="example.thumbnailUrl"
    :alt="example.title"
    loading="lazy"
    class="aspect-4/3 w-full object-cover"
  />
</template>
