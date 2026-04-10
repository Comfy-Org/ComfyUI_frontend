<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const industryKeys = [
  'All',
  'VFX',
  'Gaming',
  'Advertising',
  'Photography'
] as const

const industryLabels = computed(() => ({
  All: t('testimonials.all', locale),
  VFX: t('testimonials.vfx', locale),
  Gaming: t('testimonials.gaming', locale),
  Advertising: t('testimonials.advertising', locale),
  Photography: t('testimonials.photography', locale)
}))

const activeFilter = ref<(typeof industryKeys)[number]>('All')

const testimonials = [
  {
    quote:
      'Comfy has transformed our VFX pipeline. The node-based approach gives us unprecedented control over every step of the generation process.',
    name: 'Sarah Chen',
    title: 'Lead Technical Artist',
    company: 'Studio Alpha',
    industry: 'VFX' as const
  },
  {
    quote:
      'The level of control over AI generation is unmatched. We can iterate on game assets faster than ever before.',
    name: 'Marcus Rivera',
    title: 'Creative Director',
    company: 'PixelForge',
    industry: 'Gaming' as const
  },
  {
    quote:
      'We\u2019ve cut our iteration time by 70%. Comfy workflows let our team produce high-quality creative assets at scale.',
    name: 'Yuki Tanaka',
    title: 'Head of AI',
    company: 'CreativeX',
    industry: 'Advertising' as const
  }
]

const filteredTestimonials = computed(() => {
  if (activeFilter.value === 'All') return testimonials
  return testimonials.filter((t) => t.industry === activeFilter.value)
})
</script>

<template>
  <section class="bg-black py-24">
    <div class="mx-auto max-w-7xl px-6">
      <h2 class="text-center text-3xl font-bold text-white">
        {{ t('testimonials.heading', locale) }}
      </h2>

      <!-- Industry filter pills -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          v-for="industry in industryKeys"
          :key="industry"
          type="button"
          :aria-pressed="activeFilter === industry"
          class="cursor-pointer rounded-full px-4 py-1.5 text-sm transition-colors"
          :class="
            activeFilter === industry
              ? 'bg-brand-yellow text-black'
              : 'border border-white/10 text-smoke-700 hover:border-brand-yellow'
          "
          @click="activeFilter = industry"
        >
          {{ industryLabels[industry] }}
        </button>
      </div>

      <!-- Testimonial cards -->
      <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <article
          v-for="testimonial in filteredTestimonials"
          :key="testimonial.name"
          class="rounded-xl border border-white/10 bg-charcoal-600 p-6"
        >
          <blockquote class="text-base italic text-white">
            &ldquo;{{ testimonial.quote }}&rdquo;
          </blockquote>

          <p class="mt-4 text-sm font-semibold text-white">
            {{ testimonial.name }}
          </p>
          <p class="text-sm text-smoke-700">
            {{ testimonial.title }}, {{ testimonial.company }}
          </p>

          <span
            class="mt-3 inline-block rounded-full bg-white/5 px-2 py-0.5 text-xs text-smoke-700"
          >
            {{ industryLabels[testimonial.industry] ?? testimonial.industry }}
          </span>
        </article>
      </div>
    </div>
  </section>
</template>
