<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import PricingFreeBanner from './PricingFreeBanner.vue'
import PricingSection from './PricingSection.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
</script>

<template>
  <PricingSection :locale>
    <template #banner>
      <PricingFreeBanner
        title-key="pricing.banner.title"
        subtitle-key="pricing.banner.subtitle"
        :cta="{
          labelKey: 'pricing.banner.cta',
          href: externalLinks.cloud,
          target: '_blank'
        }"
        :locale
      />
    </template>
  </PricingSection>
</template>
