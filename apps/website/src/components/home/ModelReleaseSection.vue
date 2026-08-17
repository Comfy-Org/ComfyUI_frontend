<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FeaturedCarousel02 from '../blocks/FeaturedCarousel02.vue'
import type { FeaturedSplitSlide } from '../blocks/FeaturedCarousel02.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

// autoplayMs values are each hero video's real duration, so the carousel
// advances as the clip finishes.
const slides: FeaturedSplitSlide[] = [
  {
    id: 'seedance-2-5',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/seedance-2.5/hero.mp4',
      poster: 'https://media.comfy.org/website/seedance-2.5/hero-poster.webp',
      alt: t('modelRelease.seedance.videoAriaLabel', locale)
    },
    eyebrow: t('modelRelease.eyebrow', locale),
    title: t('modelRelease.seedance.title', locale),
    body: t('modelRelease.seedance.body', locale),
    primaryCta: {
      label: t('modelRelease.seedance.explore', locale),
      href: routes.seedance
    },
    secondaryCta: {
      label: t('cta.tryWorkflow', locale),
      href: 'https://cloud.comfy.org/?template=api_seedance2_5_r2v',
      newTab: true
    },
    tags: [t('tags.partnerNodes', locale)],
    autoplayMs: 17000
  },
  {
    id: 'ltx-2-5',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/ltx-2.5/hero.mp4',
      poster: 'https://media.comfy.org/website/ltx-2.5/hero-poster.webp',
      alt: t('modelRelease.ltx.videoAriaLabel', locale)
    },
    eyebrow: t('modelRelease.eyebrow', locale),
    title: t('modelRelease.ltx.title', locale),
    body: t('modelRelease.ltx.body', locale),
    primaryCta: {
      label: t('modelRelease.ltx.explore', locale),
      href: routes.ltx
    },
    secondaryCta: {
      label: t('cta.tryForFree', locale),
      href: 'https://cloud.comfy.org/?template=video_ltx2_5_i2v',
      newTab: true
    },
    tags: [t('tags.openSource', locale), t('tags.partnerNodes', locale)],
    autoplayMs: 20000
  },
  {
    id: 'wan-animate-2',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/wan-animate-2/hero.mp4',
      poster: 'https://media.comfy.org/website/wan-animate-2/hero-poster.webp',
      alt: t('modelRelease.wanAnimate2.videoAriaLabel', locale)
    },
    eyebrow: t('modelRelease.eyebrow', locale),
    title: t('modelRelease.wanAnimate2.title', locale),
    body: t('modelRelease.wanAnimate2.body', locale),
    primaryCta: {
      label: t('modelRelease.wanAnimate2.explore', locale),
      href: routes.wanAnimate2
    },
    secondaryCta: {
      label: t('cta.tryForFree', locale),
      href: 'https://cloud.comfy.org/?template=video_wan_animate2',
      newTab: true
    },
    tags: [t('tags.openWeights', locale)],
    autoplayMs: 18400
  },
  {
    id: 'minimax-h3',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/minimax/hero.mp4',
      poster: 'https://media.comfy.org/website/minimax/hero-poster.webp',
      alt: t('modelRelease.minimax.videoAriaLabel', locale)
    },
    eyebrow: t('modelRelease.eyebrow', locale),
    title: t('modelRelease.minimax.title', locale),
    body: t('modelRelease.minimax.body', locale),
    primaryCta: {
      label: t('modelRelease.minimax.explore', locale),
      href: routes.minimax
    },
    secondaryCta: {
      label: t('cta.tryForFree', locale),
      href: 'https://cloud.comfy.org/?share=a781503cf508',
      newTab: true
    },
    tags: [t('tags.openWeights', locale), t('tags.partnerNodes', locale)],
    autoplayMs: 8000
  }
]
</script>

<template>
  <FeaturedCarousel02 :locale :slides class="py-14 md:py-20" />
</template>
