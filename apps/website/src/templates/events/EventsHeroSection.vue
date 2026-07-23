<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import FeaturedCarousel01 from '../../components/blocks/FeaturedCarousel01.vue'
import type { FeaturedSlide } from '../../components/blocks/FeaturedCarousel01.vue'
import HeroCentered01 from '../../components/blocks/HeroCentered01.vue'
import { featuredEvents } from '../../data/events'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const slides = computed<FeaturedSlide[]>(() =>
  featuredEvents.map((event) => ({
    id: event.id,
    media: {
      type: event.media.type,
      src: event.media.src,
      alt: event.media.alt[locale],
      poster: event.media.type === 'video' ? event.media.poster : undefined
    },
    eyebrow: event.eyebrow[locale],
    title: event.title[locale],
    showTitle: event.showTitle,
    href: event.href?.[locale]
  }))
)
</script>

<template>
  <section class="pt-24 pb-16 lg:pt-30 lg:pb-24">
    <HeroCentered01
      :eyebrow="t('events.hero.eyebrow', locale)"
      :title="t('events.hero.title', locale)"
      :subtitle="t('events.hero.subtitle', locale)"
    />

    <div class="mt-12 lg:mt-20">
      <FeaturedCarousel01
        :slides
        :prev-label="t('events.hero.prevSlide', locale)"
        :next-label="t('events.hero.nextSlide', locale)"
      />
    </div>
  </section>
</template>
