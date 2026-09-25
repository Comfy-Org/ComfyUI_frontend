<script setup lang="ts">
import ButtonPill from '@/components/ui/button-pill/ButtonPill.vue'

import { prefersReducedMotion } from '../../../composables/useReducedMotion'
import type { NavFeatured } from '../../../data/mainNavigation'

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
        :aria-label="featured.imageAlt"
        width="744"
        height="558"
        :autoplay="!prefersReducedMotion()"
        muted
        playsinline
        @timeupdate="pauseBeforeAutoplayLimit"
      />
      <img
        v-else
        class="aspect-4/3 w-62 max-w-none rounded-xl object-cover"
        :src="featured.imageSrc"
        :alt="featured.imageAlt ?? ''"
        width="744"
        height="558"
        loading="lazy"
        decoding="async"
      />
      <p class="mt-4 font-extrabold uppercase">
        {{ featured.title }}
      </p>
      <div class="mt-1">
        <ButtonPill as="span" icon-position="left" variant="ghost">
          {{ featured.cta.label }}
        </ButtonPill>
      </div>
    </a>
  </li>
</template>
