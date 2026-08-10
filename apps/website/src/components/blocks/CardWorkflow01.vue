<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import { resolveRel } from '../../utils/cta'
import Badge from '../ui/badge/Badge.vue'

type CardWorkflowMedia = {
  type: 'image' | 'video'
  src: string
  alt: string
  poster?: string
}

export type CardWorkflowItem = {
  id: string
  title: string
  href: string
  media: CardWorkflowMedia
  description?: string
  tags?: readonly string[]
}

const { item, class: className } = defineProps<{
  item: CardWorkflowItem
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-transparency-white-t4 rounded-4.5xl relative flex flex-col px-2 pt-2 pb-8 transition-colors duration-200 hover:bg-transparency-white-t8',
        className
      )
    "
  >
    <a
      :href="item.href"
      target="_blank"
      :rel="resolveRel({ target: '_blank' })"
      :aria-label="item.title"
      class="focus-visible:ring-primary-comfy-yellow rounded-4.5xl absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    />

    <div
      class="bg-transparency-white-t4 relative aspect-4/3 overflow-hidden rounded-[2.25rem]"
    >
      <img
        v-if="item.media.type === 'image'"
        :src="item.media.src"
        :alt="item.media.alt"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
      />
      <video
        v-else
        :src="item.media.src"
        :poster="item.media.poster"
        :aria-label="item.media.alt"
        autoplay
        loop
        muted
        playsinline
        preload="metadata"
        class="size-full object-cover"
      />
    </div>

    <div class="flex grow flex-col px-6 pt-6">
      <h3 class="text-2xl leading-[1.4] font-medium text-primary-comfy-canvas">
        {{ item.title }}
      </h3>
      <p
        v-if="item.description"
        class="mt-4 text-sm leading-[1.6] font-light text-primary-comfy-canvas"
      >
        {{ item.description }}
      </p>
      <div
        v-if="item.tags?.length"
        class="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 pt-6"
      >
        <Badge
          v-for="tag in item.tags"
          :key="tag"
          variant="subtle"
          size="md"
          class="shrink-0 py-2 uppercase"
        >
          {{ tag }}
        </Badge>
      </div>
    </div>
  </div>
</template>
