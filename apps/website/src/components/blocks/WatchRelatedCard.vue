<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import PlayOverlay from './PlayOverlay.vue'

export type WatchRelatedItem = {
  id: string
  label: string
  href: string
  poster: string
  /** Accessible name for the link; falls back to the label. */
  title?: string
}

const { item, class: className } = defineProps<{
  item: WatchRelatedItem
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <a
    :href="item.href"
    :aria-label="item.title ?? item.label"
    :class="
      cn(
        'group relative block aspect-video w-57 overflow-hidden rounded-2xl',
        className
      )
    "
  >
    <img
      :src="item.poster"
      alt=""
      loading="lazy"
      decoding="async"
      class="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
    />
    <PlayOverlay size="sm" class="text-white" />
    <span class="absolute bottom-2 left-3 text-xs text-primary-warm-white">
      {{ item.label }}
    </span>
  </a>
</template>
