<script setup lang="ts">
import SiteVideo from '@/components/common/SiteVideo.vue'
import type { AgencyWorkItem } from './draftTypes'

defineProps<{ item: AgencyWorkItem }>()
</script>

<template>
  <SiteVideo
    v-if="item.type === 'video' && item.videoName && item.baseUrl"
    :name="item.videoName"
    :base-url="item.baseUrl"
    :width="item.width ?? 960"
    :formats="['mp4']"
    :poster="item.poster"
    :alt="item.alt"
    controls
    :autoplay="false"
    :muted="false"
    preload="none"
    container-class="aspect-video overflow-hidden rounded-3xl bg-primary-comfy-ink"
    video-class="aspect-video object-contain"
  />
  <img
    v-else
    :src="item.src"
    :alt="item.alt"
    loading="lazy"
    decoding="async"
    class="aspect-video w-full rounded-3xl object-contain"
  />
</template>
