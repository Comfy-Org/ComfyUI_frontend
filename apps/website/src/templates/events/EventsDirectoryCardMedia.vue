<script setup lang="ts">
import type { DirectoryRow } from '../../utils/eventsDirectory'

const { media, reducedMotion } = defineProps<{
  media: NonNullable<DirectoryRow['media']>
  reducedMotion: boolean
}>()
</script>

<template>
  <div class="aspect-video w-full overflow-hidden rounded-4xl">
    <img
      v-if="!media.isVideo"
      :src="media.src"
      :alt="media.alt"
      loading="lazy"
      decoding="async"
      class="size-full object-cover object-center"
    />
    <img
      v-else-if="reducedMotion && media.poster"
      :src="media.poster"
      :alt="media.alt"
      loading="lazy"
      decoding="async"
      class="size-full object-cover object-center"
    />
    <video
      v-else
      :src="media.src"
      :poster="media.poster"
      :aria-label="media.alt"
      :autoplay="!reducedMotion"
      loop
      muted
      playsinline
      preload="metadata"
      class="size-full object-cover object-center"
    />
  </div>
</template>
