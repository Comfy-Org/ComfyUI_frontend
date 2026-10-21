<script setup lang="ts">
import { useTemplateRef } from 'vue'

import HubThumbnailMedia from '@/components/hub/HubThumbnailMedia.vue'
import { thumbnailImageClass } from '@/components/hub/thumbnailImageClass'

import { usePreviewVideo } from '@/composables/usePreviewVideo'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'

const { model, locale = 'en' } = defineProps<{
  model: Pick<WorkshopModel, 'name' | 'thumbnail'>
  locale?: Locale
}>()
const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () => model.thumbnail?.url)
</script>

<template>
  <HubThumbnailMedia
    v-if="model.thumbnail?.primaryUrl && model.thumbnail.secondaryUrl"
    :primary-url="model.thumbnail.primaryUrl"
    :secondary-url="model.thumbnail.secondaryUrl"
    :variant="model.thumbnail.variant"
    :title="model.name"
    :locale
    inside-link
    data-testid="model-card-media"
  />
  <!-- The card names itself in its heading and marks its provider over the
    artwork, so a third reading of the name here is noise in the link. -->
  <img
    v-else-if="model.thumbnail?.staticUrl"
    :src="model.thumbnail.staticUrl"
    alt=""
    :class="thumbnailImageClass(model.thumbnail.variant)"
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
    :class="thumbnailImageClass(model.thumbnail.variant)"
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
