<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchPricing } from './types'

import PricingFreeBanner from '../../components/pricing/PricingFreeBanner.vue'
import PricingSection from '../../components/pricing/PricingSection.vue'

const { locale, pricing } = defineProps<{
  pricing: ModelLaunchPricing
  locale: Locale
}>()
</script>

<template>
  <PricingSection
    heading-level="h2"
    :default-billing-cycle="pricing.defaultBillingCycle"
    :locale
  >
    <template v-if="pricing.banner" #banner>
      <PricingFreeBanner
        :title-key="pricing.banner.titleKey"
        :subtitle-key="pricing.banner.subtitleKey"
        :cta="pricing.banner.cta"
        :locale
      />
    </template>
  </PricingSection>
</template>
