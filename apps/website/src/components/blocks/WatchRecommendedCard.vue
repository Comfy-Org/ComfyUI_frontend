<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import Badge from '../ui/badge/Badge.vue'
import PlayOverlay from './PlayOverlay.vue'

type WatchRecommendedItem = {
  id: string
  title: string
  credit?: string
  tag?: string
  href: string
  poster: string
}

const { item, class: className } = defineProps<{
  item: WatchRecommendedItem
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <a :href="item.href" :class="cn('group block', className)">
    <span class="relative block aspect-video overflow-hidden rounded-3xl">
      <img
        :src="item.poster"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <PlayOverlay class="text-white" />
    </span>
    <span class="mt-4 block text-xl font-medium text-primary-comfy-canvas">
      {{ item.title }}
    </span>
    <span v-if="item.credit || item.tag" class="mt-2 flex items-center gap-4">
      <span
        v-if="item.credit"
        class="text-sm font-light text-primary-comfy-canvas"
      >
        {{ item.credit }}
      </span>
      <Badge v-if="item.tag" variant="accent">{{ item.tag }}</Badge>
    </span>
  </a>
</template>
