<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchPricing } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import PricingSection from '../../components/pricing/PricingSection.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', pricing } = defineProps<{
  pricing: ModelLaunchPricing
  locale?: Locale
}>()
</script>

<template>
  <PricingSection
    heading-level="h2"
    :default-billing-cycle="pricing.defaultBillingCycle"
    :locale
  >
    <template v-if="pricing.banner" #banner>
      <div
        class="bg-primary-comfy-ink-light mb-4 flex flex-col gap-4 rounded-3xl px-8 py-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-lg font-bold text-primary-comfy-canvas">
            {{ t(pricing.banner.titleKey, locale) }}
          </p>
          <p class="mt-1 text-sm text-primary-comfy-canvas">
            {{ t(pricing.banner.subtitleKey, locale) }}
          </p>
        </div>
        <BrandButton
          :href="pricing.banner.cta.href"
          :target="pricing.banner.cta.target"
          variant="outline"
          size="xs"
          class="shrink-0 self-start sm:self-auto"
        >
          {{ t(pricing.banner.cta.labelKey, locale) }}
        </BrandButton>
      </div>
    </template>
  </PricingSection>
</template>
