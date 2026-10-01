<script setup lang="ts">
import { computed } from 'vue'
import { useMounted } from '@vueuse/core'

import { useWorkshopEnabled } from '../../scripts/posthog'
import { getRoutes } from '../../config/routes'
import { modelReleaseSlides } from '../../data/modelRelease'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'
import FeaturedCarousel02 from '../blocks/FeaturedCarousel02.vue'
import type { FeaturedSplitSlide } from '../blocks/FeaturedCarousel02.vue'

const { locale = 'en', modelLinks = {} } = defineProps<{
  locale?: Locale
  modelLinks?: Readonly<Partial<Record<string, string>>>
}>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)

const enabled = useWorkshopEnabled()
const mounted = useMounted()
const slides = computed<FeaturedSplitSlide[]>(() =>
  modelReleaseSlides.map((slide) => {
    const workshopUrl =
      mounted.value && enabled.value ? modelLinks[slide.id] : undefined
    return {
      id: slide.id,
      media: {
        type: slide.media.type,
        src: slide.media.src,
        poster: slide.media.poster,
        alt: t(slide.media.ariaLabelKey)
      },
      eyebrow: t('modelRelease.eyebrow'),
      title: t(slide.titleKey),
      body: t(slide.bodyKey),
      primaryCta: {
        label: t(slide.exploreLabelKey),
        href: workshopUrl ?? routes[slide.exploreRoute]
      },
      secondaryCta: {
        label: t(slide.tryCta.labelKey),
        href: workshopUrl ?? slide.tryCta.href,
        newTab: !workshopUrl
      },
      tags: slide.tagKeys.map((key) => t(key)),
      autoplayMs: slide.autoplayMs
    }
  })
)
</script>

<template>
  <FeaturedCarousel02 :locale :slides class="px-4 py-20 lg:px-20 lg:py-24" />
</template>
