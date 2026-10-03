<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import FeaturedCarousel01 from '../../components/blocks/FeaturedCarousel01.vue'
import type { FeaturedSlide } from '../../components/blocks/FeaturedCarousel01.vue'
import HeroCentered01 from '../../components/blocks/HeroCentered01.vue'
import Button from '../../components/ui/button/Button.vue'
import { featuredEvents } from '../../data/events'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const slides = computed<FeaturedSlide[]>(() =>
  featuredEvents.map((event) => ({
    id: event.id,
    media: {
      type: event.media.type,
      src: event.media.src,
      alt: event.media.alt[locale] || event.media.alt.en,
      poster: event.media.type === 'video' ? event.media.poster : undefined
    },
    eyebrow: event.eyebrow?.[locale] || event.eyebrow?.en,
    title: event.title[locale] || event.title.en,
    showTitle: event.showTitle,
    href: event.href?.[locale] || event.href?.en,
    newTab: event.newTab,
    autoplayMs: event.autoplayMs
  }))
)
</script>

<template>
  <section class="pt-24 pb-16 lg:pt-30 lg:pb-24">
    <HeroCentered01
      :eyebrow="t('events.hero.eyebrow')"
      :title="t('events.hero.title')"
      :subtitle="t('events.hero.subtitle')"
    >
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <Button as="a" href="#events-directory">
          {{ t('events.hero.browseEvents') }}
        </Button>
        <Button as="a" variant="outline" href="#host-an-event">
          {{ t('events.hero.hostAnEvent') }}
        </Button>
      </div>
    </HeroCentered01>

    <div class="mt-12 lg:mt-20">
      <FeaturedCarousel01
        :slides
        :prev-label="t('events.hero.prevSlide')"
        :next-label="t('events.hero.nextSlide')"
      />
    </div>
  </section>
</template>
