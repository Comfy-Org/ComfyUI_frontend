<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import ProductHeroBadge from '../common/ProductHeroBadge.vue'
import VideoPlayer from '../common/VideoPlayer.vue'
import CheckIcon from '../icons/CheckIcon.vue'

type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

type VideoTrack = {
  src: string
  kind: 'subtitles' | 'captions' | 'descriptions'
  srclang: string
  label: string
}

const {
  locale = 'en',
  badgeText,
  badgeLogoSrc,
  badgeLogoAlt,
  title,
  titleHighlight,
  features = [],
  primaryCta,
  secondaryCta,
  imageSrc,
  imageAlt = '',
  imageWidth = 800,
  imageHeight = 600,
  imagePosition = 'right',
  videoSrc,
  videoPoster,
  videoTracks = [],
  videoAutoplay = false,
  videoLoop = false,
  videoMinimal = false,
  videoHideControls = false
} = defineProps<{
  locale?: Locale
  badgeText: string
  badgeLogoSrc?: string
  badgeLogoAlt?: string
  title: string
  titleHighlight?: string
  features?: string[]
  primaryCta: Cta
  secondaryCta?: Cta
  imageSrc?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  imagePosition?: 'left' | 'right'
  videoSrc?: string
  videoPoster?: string
  videoTracks?: VideoTrack[]
  videoAutoplay?: boolean
  videoLoop?: boolean
  videoMinimal?: boolean
  videoHideControls?: boolean
}>()
</script>

<template>
  <section
    :class="
      cn(
        'max-w-9xl relative mx-auto flex flex-col items-center gap-12 px-6 pt-20 pb-16 md:pt-28 md:pb-24 lg:items-center lg:gap-16 lg:px-16',
        imagePosition === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse'
      )
    "
  >
    <div class="w-full lg:flex-1">
      <ProductHeroBadge
        :text="badgeText"
        :logo-src="badgeLogoSrc"
        :logo-alt="badgeLogoAlt"
      />

      <h1
        class="mt-8 text-2xl leading-[125%] font-light tracking-[-1.44px] text-primary-comfy-canvas md:text-4xl lg:text-5xl"
      >
        <template v-if="titleHighlight">
          <span class="text-primary-warm-white">{{ titleHighlight }}</span>
          {{ title }}
        </template>
        <template v-else>{{ title }}</template>
      </h1>

      <ul v-if="features.length" class="mt-8 space-y-3">
        <li
          v-for="feature in features"
          :key="feature"
          class="flex items-start gap-3 text-base text-primary-comfy-canvas"
        >
          <CheckIcon class="text-primary-comfy-yellow mt-1 size-5 shrink-0" />
          {{ feature }}
        </li>
      </ul>

      <div class="mt-10 flex flex-col gap-4 sm:flex-row">
        <BrandButton
          :href="primaryCta.href"
          :target="primaryCta.target"
          size="lg"
          class="px-8 py-4 text-base uppercase"
        >
          {{ primaryCta.label }}
        </BrandButton>
        <BrandButton
          v-if="secondaryCta"
          :href="secondaryCta.href"
          :target="secondaryCta.target"
          variant="outline"
          size="lg"
          class="px-8 py-4 text-base uppercase"
        >
          {{ secondaryCta.label }}
        </BrandButton>
      </div>
    </div>

    <div class="order-first w-full lg:order-last lg:flex-1">
      <VideoPlayer
        v-if="videoSrc"
        :locale
        :src="videoSrc"
        :poster="videoPoster"
        :tracks="videoTracks"
        :autoplay="videoAutoplay"
        :loop="videoLoop"
        :minimal="videoMinimal"
        :hide-controls="videoHideControls"
      />
      <img
        v-else-if="imageSrc"
        :src="imageSrc"
        :alt="imageAlt"
        :width="imageWidth"
        :height="imageHeight"
        fetchpriority="high"
        decoding="async"
        class="aspect-4/3 w-full rounded-3xl object-cover"
      />
    </div>
  </section>
</template>
