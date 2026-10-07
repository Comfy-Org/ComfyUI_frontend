<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchReviews } from './types'

import ScrollCarousel from '@/components/ui/scroll-carousel/ScrollCarousel.vue'
import { creatorReviews } from '@/data/creatorReviews'
import { translationsFor } from '@/i18n/translations'
import ModelLaunchHighlightCard from './ModelLaunchHighlightCard.vue'

const { locale = 'en', reviews } = defineProps<{
  reviews: ModelLaunchReviews
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const quotes = creatorReviews.map((review) => ({
  id: review.id,
  body: review.body[locale] || review.body.en,
  name: review.name,
  role: review.role?.[locale] || review.role?.en
}))
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 pt-0 pb-16 lg:px-16 lg:pt-4 lg:pb-24">
    <ModelLaunchHighlightCard
      v-if="reviews.highlight"
      :highlight="reviews.highlight"
      :locale
    />

    <h2
      :class="
        cn(
          'text-center text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight',
          reviews.highlight && 'mt-20 lg:mt-28'
        )
      "
    >
      {{ t(reviews.headingKey) }}
    </h2>

    <ScrollCarousel
      :locale
      gap-class="gap-8"
      class="mt-12 max-w-none p-0 lg:mt-16 lg:p-0"
    >
      <article
        v-for="quote in quotes"
        :key="quote.id"
        class="flex w-full shrink-0 snap-start flex-col justify-between rounded-5xl bg-transparency-white-t4 p-8 lg:w-2/3 lg:p-12"
      >
        <p
          class="text-xl/relaxed font-light text-primary-comfy-canvas lg:text-2xl/relaxed"
        >
          "{{ quote.body }}"
        </p>

        <p class="mt-10 text-base text-primary-comfy-yellow lg:mt-12">
          <span class="font-medium">{{ quote.name }}</span
          ><template v-if="quote.role">,<br />{{ quote.role }}</template>
        </p>
      </article>
    </ScrollCarousel>
  </section>
</template>
