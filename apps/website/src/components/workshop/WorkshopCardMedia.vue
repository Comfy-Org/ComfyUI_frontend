<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { usePreviewVideo } from '../../composables/usePreviewVideo'
import type { WorkshopModel } from '../../config/models-catalogue'

const { model } = defineProps<{ model: WorkshopModel }>()
const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () => model.thumbnail?.url)
</script>

<template>
  <video
    v-if="model.thumbnail?.kind === 'video'"
    ref="video"
    :src="previewSrc"
    :aria-label="model.name"
    class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
    muted
    loop
    playsinline
    preload="metadata"
  />
  <img
    v-else-if="model.thumbnail"
    :src="model.thumbnail.url"
    :alt="model.name"
    class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
  <div
    v-else
    class="grid size-full place-items-center bg-hub-surface-hover"
    data-testid="model-media-placeholder"
  >
    <span
      class="font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
      aria-hidden="true"
    >
      {{ model.name[0] }}
    </span>
  </div>
</template>
