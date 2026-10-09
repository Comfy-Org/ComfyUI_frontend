<script setup lang="ts">
import { computed, onMounted } from 'vue'

import PlayOverlay from '@/components/blocks/PlayOverlay.vue'
import ButtonPill from '@/components/ui/button-pill/ButtonPill.vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'
import type { NavFeatured } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import {
  captureNavFeaturedCardClicked,
  captureNavFeaturedCardViewed,
  readFlagVariant
} from '@/scripts/posthog'
import {
  buildNavFeaturedCardEventProperties,
  getFeaturedImageFlagKey,
  resolveFeaturedMedia
} from '@/utils/navFeaturedCard'

const { featured, dropdown, locale } = defineProps<{
  featured: NavFeatured
  dropdown: string
  locale: Locale
}>()

// The dropdown content only mounts once the menu opens (the server-rendered
// header holds no card), so the flag is read once here, when the card first
// appears, and the media stays put for the whole open. A flag that has not
// answered yet resolves to the control card.
const flagValue = readFlagVariant(getFeaturedImageFlagKey(featured))
const media = computed(() => resolveFeaturedMedia(featured, flagValue))

function eventProperties() {
  return buildNavFeaturedCardEventProperties({
    featured,
    dropdown,
    variant: media.value.variant,
    locale
  })
}

// reka-ui unmounts closed menu content (unmountOnHide), so mounting is the
// card appearing, for a click and a hover open alike.
onMounted(() => captureNavFeaturedCardViewed(eventProperties()))

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
      @click="captureNavFeaturedCardClicked(eventProperties())"
    >
      <video
        v-if="media.videoSrc"
        class="aspect-4/3 w-62 max-w-none rounded-xl object-cover"
        :src="media.videoSrc"
        :poster="media.imageSrc"
        :aria-label="media.imageAlt"
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
          :src="media.imageSrc"
          :alt="media.imageAlt ?? ''"
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
      <div class="mt-1">
        <ButtonPill as="span" icon-position="left" variant="ghost">
          {{ featured.cta.label }}
        </ButtonPill>
      </div>
    </a>
  </li>
</template>
