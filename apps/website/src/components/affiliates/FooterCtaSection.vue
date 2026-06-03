<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <section
    class="bg-secondary-mauve/30 mt-12 border-t border-primary-comfy-canvas/10 px-6 py-20 text-center md:py-28"
    data-testid="affiliate-footer-cta"
  >
    <h2
      class="text-3xl font-light text-primary-comfy-canvas md:text-4xl lg:text-5xl"
    >
      {{ t('affiliate-landing.footerCta.heading', locale) }}
    </h2>
    <div class="mt-8 flex flex-col items-center gap-4">
      <BrandButton
        :href="externalLinks.affiliateApplicationForm"
        target="_blank"
        rel="noopener noreferrer"
        size="lg"
        :aria-label="t('affiliate-landing.cta.applyAriaLabel', locale)"
        data-testid="affiliate-footer-cta-button"
        class="px-8 py-4 text-base"
      >
        {{ t('affiliate-landing.cta.apply', locale) }}
      </BrandButton>
      <a
        :href="routes.affiliateTerms"
        class="text-sm text-primary-comfy-canvas/70 underline-offset-4 hover:underline"
      >
        {{ t('affiliate-landing.footerCta.termsLink', locale) }}
      </a>
    </div>
  </section>
</template>
