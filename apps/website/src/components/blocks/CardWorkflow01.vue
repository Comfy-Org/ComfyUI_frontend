<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ChevronRight } from '@lucide/vue'

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
  creator: { name: string; avatarSrc: string; href?: string }
  tags?: string[]
}

const {
  item,
  tryNowLabel,
  class: className
} = defineProps<{
  item: CardWorkflowItem
  tryNowLabel: string
  class?: HTMLAttributes['class']
}>()
</script>

<!-- Replica of the workflow card on comfy.org/workflows; hub tokens map to
     ours as hub-surface → transparency-white-t4, hub-surface-hover →
     transparency-white-t8, content → primary-comfy-canvas. -->
<template>
  <div
    :class="
      cn(
        'group/pill-trigger bg-transparency-white-t4 relative flex flex-col gap-4 rounded-4xl px-2 pt-2 pb-6 transition-colors duration-200 hover:bg-transparency-white-t8',
        className
      )
    "
  >
    <a
      :href="item.href"
      target="_blank"
      :rel="resolveRel({ target: '_blank' })"
      :aria-label="`${item.title} — ${tryNowLabel}`"
      class="focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 rounded-4xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    />

    <div
      class="bg-transparency-white-t4 relative aspect-4/3 overflow-hidden rounded-[1.75rem]"
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
        class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />
      <h3
        class="pointer-events-none absolute inset-x-5 bottom-5 line-clamp-2 text-base leading-[1.3] font-medium text-primary-warm-white drop-shadow-md sm:text-lg lg:text-xl"
      >
        {{ item.title }}
      </h3>
    </div>

    <div class="flex flex-col gap-4 px-4">
      <div class="flex items-center justify-between gap-2">
        <component
          :is="item.creator.href ? 'a' : 'span'"
          :href="item.creator.href"
          :target="item.creator.href ? '_blank' : undefined"
          :rel="
            item.creator.href ? resolveRel({ target: '_blank' }) : undefined
          "
          class="relative z-20 flex w-fit min-w-0 items-center gap-2 text-primary-comfy-canvas/95 transition-colors"
          :class="item.creator.href && 'hover:text-primary-comfy-canvas'"
        >
          <img
            :src="item.creator.avatarSrc"
            alt=""
            loading="lazy"
            decoding="async"
            class="size-5 shrink-0 rounded-full object-cover"
          />
          <span class="ppformula-text-center truncate text-base">
            {{ item.creator.name }}
          </span>
        </component>

        <!-- Hub's reveal-mode ButtonPill: icon-only until the card is
             hovered, then the label unfolds. Decorative — the stretched
             card link above carries the navigation. -->
        <span
          class="group-hover/pill-trigger:bg-primary-comfy-yellow relative inline-flex h-10 w-fit shrink-0 items-center overflow-hidden rounded-2xl bg-transparent py-2.5 ps-9 pe-0 text-sm font-bold tracking-wider text-nowrap text-primary-comfy-canvas uppercase transition-all duration-500 group-hover/pill-trigger:pe-5 group-hover/pill-trigger:text-primary-comfy-ink"
          aria-hidden="true"
        >
          <span
            class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 group-hover/pill-trigger:grid-cols-[1fr]"
          >
            <span class="overflow-hidden">
              <span class="ppformula-text-center relative leading-none">
                {{ tryNowLabel }}
              </span>
            </span>
          </span>
          <span
            class="group-hover/pill-trigger:bg-primary-comfy-yellow absolute top-1/2 left-1 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/20 text-white transition-all duration-500 group-hover/pill-trigger:text-primary-comfy-ink"
          >
            <ChevronRight class="size-4" :stroke-width="2" />
          </span>
        </span>
      </div>

      <div
        v-if="item.tags?.length"
        class="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden"
      >
        <Badge
          v-for="tag in item.tags"
          :key="tag"
          variant="subtle"
          size="md"
          class="h-6 shrink-0"
        >
          {{ tag }}
        </Badge>
      </div>
    </div>
  </div>
</template>
