<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
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
  locale,
  badgeText,
  badgeLogoSrc,
  badgeLogoAlt,
  badgeShowLogo = true,
  title,
  titleClass,
  titleHighlight,
  subtitle,
  subtitleClass,
  mediaWrapperClass,
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
  videoHideControls = false,
  videoPlayButtonVariant = 'solid',
  videoAriaLabel,
  compact = false,
  ctaWrapperClass,
  beta = false,
  class: className
} = defineProps<{
  locale: Locale
  class?: HTMLAttributes['class']
  badgeText: string
  badgeLogoSrc?: string
  badgeLogoAlt?: string
  badgeShowLogo?: boolean
  title: string
  titleClass?: HTMLAttributes['class']
  titleHighlight?: string
  subtitle?: string
  subtitleClass?: HTMLAttributes['class']
  mediaWrapperClass?: HTMLAttributes['class']
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
  videoPlayButtonVariant?: 'solid' | 'overlay'
  videoAriaLabel?: string
  compact?: boolean
  ctaWrapperClass?: HTMLAttributes['class']
  beta?: boolean
}>()
</script>

<template>
  <section
    :class="
      cn(
        'max-w-9xl relative mx-auto flex flex-col items-center gap-12 px-6 pt-20 pb-16 md:pt-28 md:pb-24 lg:items-center lg:gap-16 lg:px-16',
        imagePosition === 'right' ? 'lg:flex-row' : 'lg:flex-row-reverse',
        className
      )
    "
  >
    <div class="w-full lg:flex-1">
      <div class="flex items-center gap-3">
        <slot name="badge">
          <ProductHeroBadge
            :text="badgeText"
            :logo-src="badgeLogoSrc"
            :logo-alt="badgeLogoAlt"
            :show-logo="badgeShowLogo"
          />
          <Badge v-if="beta" variant="accent" size="xs">
            {{ t('nav.badgeBeta', locale) }}
          </Badge>
        </slot>
      </div>

      <h1
        :class="
          cn(
            'mt-8 leading-[125%] font-light whitespace-pre-line text-primary-comfy-canvas',
            compact
              ? 'text-xl tracking-tight md:text-2xl lg:text-3xl'
              : 'text-2xl tracking-[-1.44px] md:text-4xl lg:text-5xl',
            titleClass
          )
        "
      >
        <template v-if="titleHighlight">
          <span class="text-primary-warm-white">{{ titleHighlight }}</span>
          {{ title }}
        </template>
        <template v-else>{{ title }}</template>
      </h1>

      <p
        v-if="subtitle"
        :class="
          cn(
            'mt-6 max-w-xl text-primary-comfy-canvas/80',
            compact ? 'text-sm' : 'text-base',
            subtitleClass
          )
        "
      >
        {{ subtitle }}
      </p>

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

      <slot name="aboveCtas" />

      <div
        :class="cn('mt-10 flex flex-col gap-4 sm:flex-row', ctaWrapperClass)"
      >
        <BrandButton
          :href="primaryCta.href"
          :target="primaryCta.target"
          :size="compact ? 'sm' : 'lg'"
          :class="cn('uppercase', !compact && 'px-8 py-4 text-base')"
        >
          {{ primaryCta.label }}
        </BrandButton>
        <BrandButton
          v-if="secondaryCta"
          :href="secondaryCta.href"
          :target="secondaryCta.target"
          variant="outline"
          :size="compact ? 'sm' : 'lg'"
          :class="cn('uppercase', !compact && 'px-8 py-4 text-base')"
        >
          {{ secondaryCta.label }}
        </BrandButton>
      </div>

      <slot name="belowCtas" />
    </div>

    <div
      :class="
        cn('order-first w-full lg:order-last lg:flex-1', mediaWrapperClass)
      "
    >
      <slot name="media">
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
          :play-button-variant="videoPlayButtonVariant"
          :aria-label="videoAriaLabel"
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
      </slot>
    </div>
  </section>
</template>
