<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { youtubeEmbedUrl } from '../../data/learningTutorials'

const {
  youtubeId,
  title,
  class: className
} = defineProps<{
  youtubeId: string
  title: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'relative aspect-video overflow-hidden rounded-4xl border border-white/10 bg-black',
        className
      )
    "
  >
    <iframe
      :src="youtubeEmbedUrl(youtubeId)"
      :title
      class="size-full"
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowfullscreen
    />
  </div>
</template>
