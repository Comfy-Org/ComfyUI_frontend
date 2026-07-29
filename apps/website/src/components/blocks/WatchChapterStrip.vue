<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import PlayOverlay from './PlayOverlay.vue'

type WatchChapterItem = {
  id: string
  label: string
  href: string
  poster: string
  /** Accessible name for the link; falls back to the label. */
  title?: string
}

const {
  heading,
  items,
  class: className
} = defineProps<{
  heading: string
  items: readonly WatchChapterItem[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div v-if="items.length" :class="cn(className)">
    <h2
      class="text-primary-warm-white text-sm font-extrabold tracking-wider uppercase"
    >
      {{ heading }}
    </h2>
    <ul class="mt-6 flex gap-4 overflow-x-auto pb-2">
      <li v-for="item in items" :key="item.id" class="shrink-0">
        <a
          :href="item.href"
          :aria-label="item.title ?? item.label"
          class="group relative block aspect-video w-57 overflow-hidden rounded-2xl"
        >
          <img
            :src="item.poster"
            alt=""
            loading="lazy"
            decoding="async"
            class="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <PlayOverlay size="sm" class="text-white" />
          <span
            class="text-primary-warm-white absolute bottom-2 left-3 text-xs"
          >
            {{ item.label }}
          </span>
        </a>
      </li>
    </ul>
  </div>
</template>
