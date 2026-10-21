<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import HubThumbnailMedia from '@/components/hub/HubThumbnailMedia.vue'

import { usePreviewVideo } from '@/composables/usePreviewVideo'
import type { WorkshopModel } from '@/config/models-catalogue'

const { model } = defineProps<{
  model: Pick<WorkshopModel, 'name' | 'thumbnail'>
}>()
const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () => model.thumbnail?.url)
const imageClass = computed(() =>
  cn(
    'size-full object-cover transition-transform select-none',
    model.thumbnail?.variant === 'zoomHover' ||
      model.thumbnail?.variant === 'hoverZoom'
      ? 'duration-500 group-hover:scale-125'
      : 'duration-300 group-hover:scale-105'
  )
)
</script>

<template>
  <HubThumbnailMedia
    v-if="model.thumbnail?.primaryUrl && model.thumbnail.secondaryUrl"
    :primary-url="model.thumbnail.primaryUrl"
    :secondary-url="model.thumbnail.secondaryUrl"
    :variant="model.thumbnail.variant"
    :title="model.name"
    data-testid="model-card-media"
  />
  <!-- The card names itself in its heading and marks its provider over the
    artwork, so a third reading of the name here is noise in the link. -->
  <img
    v-else-if="model.thumbnail?.staticUrl"
    :src="model.thumbnail.staticUrl"
    alt=""
    :class="imageClass"
    data-testid="model-card-media"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
  <video
    v-else-if="model.thumbnail?.kind === 'video'"
    ref="video"
    :src="previewSrc"
    :poster="model.thumbnail.poster"
    class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
    aria-hidden="true"
    data-testid="model-card-media"
    muted
    loop
    playsinline
    preload="metadata"
  />
  <img
    v-else-if="model.thumbnail && model.thumbnail.kind !== 'audio'"
    :src="model.thumbnail.url"
    alt=""
    :class="imageClass"
    data-testid="model-card-media"
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
