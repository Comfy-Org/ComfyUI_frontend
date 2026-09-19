<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import PlayOverlay from '@/components/blocks/PlayOverlay.vue'

import type { NavFeatured } from '../../../data/mainNavigation'

defineProps<{ featured: NavFeatured }>()
</script>

<template>
  <li class="shrink-0">
    <a
      :href="featured.cta.href"
      :aria-label="featured.cta.ariaLabel"
      class="group/pill-trigger relative block"
    >
      <video
        v-if="featured.videoSrc"
        class="aspect-4/3 w-62 max-w-none rounded-xl object-cover"
        :src="featured.videoSrc"
        :poster="featured.imageSrc"
        width="744"
        height="558"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        aria-hidden="true"
      />
      <span v-else class="relative block w-62">
        <img
          class="aspect-4/3 w-62 max-w-none rounded-xl"
          :src="featured.imageSrc"
          :alt="featured.imageAlt ?? ''"
          width="744"
          height="558"
          loading="lazy"
          decoding="async"
        />
        <PlayOverlay
          v-if="featured.showPlayOverlay"
          size="nav"
          class="text-white"
        />
      </span>
      <p class="mt-4 text-sm font-extrabold uppercase">
        {{ featured.title }}
      </p>
      <span
        class="mt-2 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-primary-comfy-yellow uppercase"
      >
        {{ featured.cta.label }}
        <span
          class="flex size-7 items-center justify-center rounded-full bg-white/20 text-white transition-colors duration-200 group-hover/pill-trigger:bg-primary-comfy-yellow group-hover/pill-trigger:text-primary-comfy-ink group-focus-visible/pill-trigger:bg-primary-comfy-yellow group-focus-visible/pill-trigger:text-primary-comfy-ink"
          aria-hidden="true"
        >
          <ChevronRight class="size-4" :stroke-width="2" />
        </span>
      </span>
    </a>
  </li>
</template>
