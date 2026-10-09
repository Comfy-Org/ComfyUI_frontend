<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import PlayOverlay from '@/components/blocks/PlayOverlay.vue'
import Button from '@/components/ui/button/Button.vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'
import type { NavFeatured } from '@/data/mainNavigation'

defineProps<{ featured: NavFeatured }>()

const WCAG_AUTOPLAY_LIMIT_SECONDS = 5
const MAX_TIMEUPDATE_INTERVAL_SECONDS = 0.25

function pauseBeforeAutoplayLimit({ currentTarget }: Event) {
  if (
    currentTarget instanceof HTMLVideoElement &&
    currentTarget.currentTime >=
      WCAG_AUTOPLAY_LIMIT_SECONDS - MAX_TIMEUPDATE_INTERVAL_SECONDS
  )
    currentTarget.pause()
}
</script>

<template>
  <li class="flex shrink-0">
    <a
      :href="featured.cta.href"
      :aria-label="featured.cta.ariaLabel"
      class="relative flex flex-col"
    >
      <video
        v-if="featured.videoSrc"
        class="aspect-4/3 w-62 max-w-none rounded-xl object-cover"
        :src="featured.videoSrc"
        :poster="featured.imageSrc"
        :aria-label="featured.imageAlt"
        width="744"
        height="558"
        :autoplay="!prefersReducedMotion()"
        muted
        playsinline
        @timeupdate="pauseBeforeAutoplayLimit"
      />
      <span v-else class="relative block w-62">
        <img
          class="aspect-4/3 w-62 max-w-none rounded-xl object-cover"
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
      <p class="mt-4 font-extrabold uppercase">
        {{ featured.title }}
      </p>
      <div class="mt-auto pt-1">
        <Button as="span" variant="link" size="sm">
          {{ featured.cta.label }}
          <template #append>
            <ArrowRight class="size-4" aria-hidden="true" />
          </template>
        </Button>
      </div>
    </a>
  </li>
</template>
