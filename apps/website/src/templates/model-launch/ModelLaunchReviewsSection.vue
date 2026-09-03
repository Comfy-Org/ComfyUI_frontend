<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchReviews } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import ScrollCarousel from '../../components/ui/scroll-carousel/ScrollCarousel.vue'
import { getRoutes } from '../../config/routes'
import { creatorReviews } from '../../data/creatorReviews'
import { t } from '../../i18n/translations'

const { locale = 'en', reviews } = defineProps<{
  reviews: ModelLaunchReviews
  locale?: Locale
}>()

const routes = getRoutes(locale)

const quotes = creatorReviews.map((review) => ({
  id: review.id,
  body: review.body[locale] || review.body.en,
  name: review.name,
  role: review.role?.[locale] || review.role?.en
}))
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 pt-0 pb-16 lg:px-16 lg:pt-4 lg:pb-24">
    <div
      class="rounded-5xl bg-primary-comfy-yellow flex flex-col gap-6 p-8 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-8"
    >
      <div class="min-w-0 flex-1">
        <h3
          class="text-2xl font-medium text-primary-comfy-ink lg:text-3xl/tight"
        >
          {{ t(reviews.highlight.titleKey, locale) }}
        </h3>
        <p class="mt-4 text-base/relaxed font-light text-primary-comfy-ink">
          {{ t(reviews.highlight.descriptionKey, locale) }}
        </p>
      </div>

      <BrandButton
        :href="routes[reviews.highlight.route ?? 'mcp']"
        variant="inverse"
        size="sm"
        class="h-12 shrink-0 px-5 uppercase"
      >
        {{ t(reviews.highlight.ctaKey, locale) }}
      </BrandButton>
    </div>

    <h2
      class="mt-20 text-center text-3xl font-light tracking-tight text-primary-comfy-canvas lg:mt-28 lg:text-5xl/tight"
    >
      {{ t(reviews.headingKey, locale) }}
    </h2>

    <ScrollCarousel
      :locale
      gap-class="gap-8"
      class="mt-12 max-w-none p-0 lg:mt-16 lg:p-0"
    >
      <article
        v-for="quote in quotes"
        :key="quote.id"
        class="bg-transparency-white-t4 rounded-5xl flex w-full shrink-0 snap-start flex-col justify-between p-8 lg:w-2/3 lg:p-12"
      >
        <p
          class="text-xl/relaxed font-light text-primary-comfy-canvas lg:text-2xl/relaxed"
        >
          "{{ quote.body }}"
        </p>

        <p class="text-primary-comfy-yellow mt-10 text-base lg:mt-12">
          <span class="font-medium">{{ quote.name }}</span
          ><template v-if="quote.role">,<br />{{ quote.role }}</template>
        </p>
      </article>
    </ScrollCarousel>
  </section>
</template>
