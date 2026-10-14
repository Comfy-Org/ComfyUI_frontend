<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { CatalogueFeature } from '@/lib/workshop/catalogue-features'

const { features, activeIndex } = defineProps<{
  features: readonly CatalogueFeature[]
  activeIndex: number
}>()

const emit = defineEmits<{ go: [index: number] }>()

function videoFrame({ media }: CatalogueFeature) {
  return media.thumbnail?.kind === 'video'
    ? `${media.thumbnail.url}#t=0.1`
    : undefined
}
</script>

<template>
  <div
    class="absolute top-4 right-4 z-10 flex gap-2 sm:top-6 sm:right-6"
    data-testid="featured-thumbs"
  >
    <button
      v-for="(feature, index) in features"
      :key="feature.key"
      type="button"
      :aria-label="feature.title"
      :aria-pressed="index === activeIndex"
      :class="
        cn(
          'grid size-10 cursor-pointer place-items-center overflow-hidden rounded-lg border-2 bg-hub-surface-hover text-sm font-semibold text-primary-warm-white transition-[border-color,opacity] outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
          index === activeIndex
            ? 'border-primary-warm-white'
            : 'border-transparent opacity-80 hover:opacity-100'
        )
      "
      @click="emit('go', index)"
    >
      <img
        v-if="feature.still"
        :src="feature.still"
        alt=""
        class="size-full object-cover"
        loading="lazy"
        decoding="async"
        draggable="false"
      />
      <video
        v-else-if="videoFrame(feature)"
        :src="videoFrame(feature)"
        class="size-full object-cover"
        aria-hidden="true"
        muted
        playsinline
        preload="metadata"
        data-testid="featured-thumb-video"
      />
      <span v-else aria-hidden="true">{{ feature.title[0] }}</span>
    </button>
  </div>
</template>
