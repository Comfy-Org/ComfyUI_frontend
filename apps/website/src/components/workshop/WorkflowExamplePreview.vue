<script setup lang="ts">
import { Music2 } from '@lucide/vue'

import type { GeneratedExample } from '@/config/models-catalogue'
import { videoPosterUrl } from '@/config/workshop-playground'
import VideoPlayer from '@/components/common/VideoPlayer.vue'
import type { Locale } from '@/i18n/translations'

const {
  example,
  poster,
  locale = 'en'
} = defineProps<{
  example: GeneratedExample
  poster?: string
  locale?: Locale
}>()
</script>

<template>
  <VideoPlayer
    v-if="example.mediaKind === 'video'"
    :src="poster ? example.thumbnailUrl : videoPosterUrl(example.thumbnailUrl)"
    :poster
    :locale
    :aria-label="example.title"
    no-cors
    class="aspect-4/3 w-full rounded-none border-0"
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
