<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import { modelReleaseSlides } from '../../data/modelRelease'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FeaturedCarousel02 from '../blocks/FeaturedCarousel02.vue'
import type { FeaturedSplitSlide } from '../blocks/FeaturedCarousel02.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const slides: FeaturedSplitSlide[] = modelReleaseSlides.map((slide) => ({
  id: slide.id,
  media: {
    type: slide.media.type,
    src: slide.media.src,
    poster: slide.media.poster,
    alt: t(slide.media.ariaLabelKey, locale)
  },
  eyebrow: t('modelRelease.eyebrow', locale),
  title: t(slide.titleKey, locale),
  body: t(slide.bodyKey, locale),
  primaryCta: {
    label: t(slide.exploreLabelKey, locale),
    href: routes[slide.exploreRoute]
  },
  secondaryCta: {
    label: t(slide.tryCta.labelKey, locale),
    href: slide.tryCta.href,
    newTab: true
  },
  tags: slide.tagKeys.map((key) => t(key, locale)),
  autoplayMs: slide.autoplayMs
}))
</script>

<template>
  <FeaturedCarousel02 :locale :slides class="py-14 md:py-20" />
</template>
