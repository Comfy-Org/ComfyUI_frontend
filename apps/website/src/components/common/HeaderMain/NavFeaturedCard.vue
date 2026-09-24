<script setup lang="ts">
import { useMediaControls } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import ButtonPill from '@/components/ui/button-pill/ButtonPill.vue'

import { prefersReducedMotion } from '../../../composables/useReducedMotion'
import type { NavFeatured } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import PlayPauseButton from '../PlayPauseButton.vue'

const { featured, locale = 'en' } = defineProps<{
  featured: NavFeatured
  locale?: Locale
}>()

const videoEl = useTemplateRef<HTMLVideoElement>('videoEl')
const { playing } = useMediaControls(videoEl)
</script>

<template>
  <li class="relative w-62 shrink-0">
    <a
      :href="featured.cta.href"
      :aria-label="featured.cta.ariaLabel"
      class="group/pill-trigger relative block"
    >
      <video
        v-if="featured.videoSrc"
        ref="videoEl"
        class="aspect-4/3 w-62 max-w-none rounded-xl object-cover"
        :src="featured.videoSrc"
        :poster="featured.imageSrc"
        :aria-label="featured.imageAlt"
        width="744"
        height="558"
        :autoplay="!prefersReducedMotion()"
        loop
        muted
        playsinline
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
    <PlayPauseButton
      v-if="featured.videoSrc"
      :playing
      size="sm"
      class="absolute top-2 right-2"
      :aria-label="
        playing ? t('player.pause', locale) : t('player.play', locale)
      "
      @click="playing = !playing"
    />
  </li>
</template>
