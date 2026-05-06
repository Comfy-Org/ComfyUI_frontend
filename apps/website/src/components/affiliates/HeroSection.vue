<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const highlightKeys: TranslationKey[] = [
  'affiliate-landing.hero.highlight.0',
  'affiliate-landing.hero.highlight.1',
  'affiliate-landing.hero.highlight.2',
  'affiliate-landing.hero.highlight.3'
]
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-stretch gap-10 px-6 pt-12 pb-16 lg:flex-row lg:items-center lg:gap-16 lg:px-20 lg:pt-20 lg:pb-24"
  >
    <div class="flex-1">
      <h1
        class="text-primary-comfy-canvas text-4xl/tight font-light md:text-5xl/tight lg:text-6xl/tight"
      >
        {{ t('affiliate-landing.hero.heading', locale) }}
      </h1>
      <p
        class="text-primary-comfy-yellow mt-4 text-2xl font-light md:text-3xl lg:text-4xl"
      >
        {{ t('affiliate-landing.hero.subheading', locale) }}
      </p>
      <p class="text-primary-comfy-canvas/80 mt-6 max-w-xl text-base">
        {{ t('affiliate-landing.hero.body', locale) }}
      </p>
      <ul class="mt-6 flex flex-col gap-3">
        <li
          v-for="key in highlightKeys"
          :key="key"
          class="text-primary-comfy-canvas flex items-start gap-3 text-base"
        >
          <span
            class="bg-primary-comfy-yellow text-primary-comfy-ink mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            aria-hidden="true"
          >
            ✓
          </span>
          <span>{{ t(key, locale) }}</span>
        </li>
      </ul>
      <div class="mt-8">
        <BrandButton
          :href="externalLinks.affiliateApplicationForm"
          target="_blank"
          rel="noopener noreferrer"
          size="lg"
          :aria-label="t('affiliate-landing.cta.applyAriaLabel', locale)"
          data-testid="affiliate-hero-cta"
          class="px-8 py-4 text-base"
        >
          {{ t('affiliate-landing.cta.apply', locale) }}
        </BrandButton>
      </div>
    </div>

    <div
      class="flex flex-1 items-center justify-center"
      data-testid="affiliate-hero-media"
    >
      <slot name="media">
        <div
          class="bg-transparency-white-t4 border-primary-comfy-canvas/10 flex aspect-video w-full max-w-xl items-center justify-center rounded-4xl border"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 200 120"
            class="text-primary-comfy-yellow size-3/5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="40" cy="60" r="14" />
            <circle cx="100" cy="30" r="10" />
            <circle cx="100" cy="90" r="10" />
            <circle cx="160" cy="60" r="14" />
            <path d="M54 60 L90 32" />
            <path d="M54 60 L90 88" />
            <path d="M110 30 L146 56" />
            <path d="M110 90 L146 64" />
          </svg>
        </div>
      </slot>
    </div>
  </section>
</template>
