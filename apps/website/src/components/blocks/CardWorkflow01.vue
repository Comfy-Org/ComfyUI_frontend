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
  href?: string
  media: CardWorkflowMedia
  description?: string
  tags?: readonly string[]
}

const {
  item,
  variant = 'default',
  class: className
} = defineProps<{
  item: CardWorkflowItem
  // 'compact' is the featured-projects grid card: tighter paddings, a
  // single-line 14px title, and sentence-case tag badges.
  variant?: 'default' | 'compact'
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-transparency-white-t4 relative flex flex-col',
        variant === 'compact'
          ? 'rounded-5xl gap-4 p-2'
          : 'rounded-4.5xl px-2 pt-2 pb-8',
        item.href &&
          'transition-colors duration-200 hover:bg-transparency-white-t8',
        className
      )
    "
  >
    <a
      v-if="item.href"
      :href="item.href"
      target="_blank"
      :rel="resolveRel({ target: '_blank' })"
      :aria-label="item.title"
      class="focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      :class="variant === 'compact' ? 'rounded-5xl' : 'rounded-4.5xl'"
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
      <div
        v-if="variant === 'compact'"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-linear-to-b from-black/24 to-transparent"
      />
    </div>

    <div
      class="flex grow flex-col"
      :class="variant === 'compact' ? 'gap-5 px-4 pb-2' : 'px-6 pt-6'"
    >
      <h3
        :class="
          variant === 'compact'
            ? 'w-full truncate text-sm leading-[1.2] font-semibold text-primary-comfy-canvas/95'
            : 'text-2xl leading-[1.4] font-medium text-primary-comfy-canvas'
        "
      >
        {{ item.title }}
      </h3>
      <p
        v-if="item.description"
        class="text-sm leading-[1.6] font-light text-primary-comfy-canvas"
        :class="variant === 'compact' ? undefined : 'mt-4'"
      >
        {{ item.description }}
      </p>
      <div
        v-if="item.tags?.length"
        class="flex min-w-0 flex-wrap items-center"
        :class="variant === 'compact' ? 'gap-2' : 'mt-auto gap-1.5 pt-6'"
      >
        <Badge
          v-for="tag in item.tags"
          :key="tag"
          variant="subtle"
          size="md"
          class="shrink-0 py-2"
          :class="variant === 'compact' ? 'font-normal' : 'uppercase'"
        >
          {{ tag }}
        </Badge>
      </div>
    </div>
  </div>
</template>
