<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import ButtonPill from '@/components/ui/button-pill/ButtonPill.vue'

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
  <li :class="cn('shrink-0', featured.compact && 'w-64')">
    <a
      :href="featured.cta.href"
      :aria-label="featured.cta.ariaLabel"
      :class="
        cn(
          'group/pill-trigger relative',
          featured.compact ? 'flex items-start gap-4' : 'block'
        )
      "
      data-testid="nav-featured-card"
    >
      <video
        v-if="featured.videoSrc"
        :class="
          cn(
            'max-w-none shrink-0 rounded-xl object-cover',
            featured.compact ? 'size-24' : 'aspect-4/3 w-62'
          )
        "
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
        :class="
          cn(
            'max-w-none shrink-0 rounded-xl object-cover',
            featured.compact ? 'size-24' : 'aspect-4/3 w-62'
          )
        "
        :src="featured.imageSrc"
        :alt="featured.imageAlt ?? ''"
        width="744"
        height="558"
        loading="lazy"
        decoding="async"
      />
      <span :class="cn('flex min-w-0 flex-col', !featured.compact && 'mt-4')">
        <span
          v-if="featured.eyebrow"
          class="text-xs font-medium tracking-wide text-primary-warm-gray uppercase"
        >
          {{ featured.eyebrow }}
        </span>
        <span class="font-extrabold uppercase">
          {{ featured.title }}
        </span>
        <span class="mt-1">
          <ButtonPill as="span" icon-position="left" variant="ghost">
            {{ featured.cta.label }}
          </ButtonPill>
        </span>
      </span>
    </a>
  </li>
</template>
